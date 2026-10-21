import type { S3Client } from '@aws-sdk/client-s3'
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { normalizeHelpSearchText } from '@/lib/portal/useHelpSearch'
import type { R2ObjectMeta } from '@/lib/r2Utils'
import { R2_DELETE_BATCH, R2_SCAN_BUDGET_MS } from '@/lib/r2/constants'

export interface R2ExplorerObject {
  key: string
  sizeBytes: number
  lastModified: Date | null
}

export interface R2ExplorerPage {
  objects: R2ExplorerObject[]
  nextCursor: string | null
  truncated: boolean
}

export interface PrefixStat {
  prefix: string
  bytes: number
  count: number
}

function objectKeyToMeta(key: string | undefined, size: number | undefined, lastModified: Date | undefined): R2ExplorerObject | null {
  if (!key) return null
  return {
    key,
    sizeBytes: Math.max(0, size ?? 0),
    lastModified: lastModified ?? null,
  }
}

/** Lists one page of bucket objects under an optional prefix (max 1000). */
export async function listR2ExplorerPage(
  s3: S3Client,
  bucket: string,
  options: {
    prefix?: string | null
    cursor?: string | null
    limit?: number
  },
): Promise<R2ExplorerPage> {
  const limit = Math.min(Math.max(1, options.limit ?? 1000), 1000)
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: options.prefix || undefined,
      MaxKeys: limit,
      ContinuationToken: options.cursor || undefined,
    }),
  )
  const objects: R2ExplorerObject[] = []
  for (const item of response.Contents ?? []) {
    const meta = objectKeyToMeta(item.Key, item.Size, item.LastModified)
    if (meta) objects.push(meta)
  }
  return {
    objects,
    nextCursor: response.IsTruncated ? (response.NextContinuationToken ?? null) : null,
    truncated: Boolean(response.IsTruncated),
  }
}

/**
 * Lists every object under `parentPrefix` (budget-paginated) and groups them
 * by the next path segment, returning per-folder size/count stats.
 * Used to show "folder sizes" in the R2 explorer.
 */
export async function collectPrefixStats(
  s3: S3Client,
  bucket: string,
  parentPrefix: string | null,
): Promise<PrefixStat[]> {
  const deadline = Date.now() + R2_SCAN_BUDGET_MS
  const prefix = parentPrefix || ''
  const stats = new Map<string, PrefixStat>()
  let cursor: string | null = null

  for (;;) {
    if (Date.now() >= deadline) break
    const page = await listR2ExplorerPage(s3, bucket, { prefix, cursor, limit: 1000 })
    for (const object of page.objects) {
      const remainder = object.key.slice(prefix.length)
      const slash = remainder.indexOf('/')
      const segment = slash === -1 ? remainder : remainder.slice(0, slash + 1)
      const folderPrefix = prefix + segment
      const current = stats.get(folderPrefix) ?? { prefix: folderPrefix, bytes: 0, count: 0 }
      current.bytes += object.sizeBytes
      current.count += 1
      stats.set(folderPrefix, current)
    }
    cursor = page.nextCursor
    if (!cursor || page.truncated === false) break
  }

  return [...stats.values()].sort((a, b) => b.bytes - a.bytes)
}

/** Tokenizes a search query and an object key, then checks all tokens match. */
export function matchSearchTokens(key: string, query: string): boolean {
  const normalizedKey = normalizeHelpSearchText(key)
    .split(/[\/\s._-]+/)
    .filter((t) => t.length > 0)
  const tokens = normalizeHelpSearchText(query)
    .split(/\s+/)
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return true
  return tokens.every((token) => normalizedKey.some((part) => part.includes(token)))
}

/** Deletes objects in batches of R2_DELETE_BATCH, returns deleted/failed counts. */
export async function deleteR2ObjectsBatch(
  s3: S3Client,
  bucket: string,
  keys: string[],
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0
  let failed = 0
  for (let i = 0; i < keys.length; i += R2_DELETE_BATCH) {
    const batch = keys.slice(i, i + R2_DELETE_BATCH)
    for (const key of batch) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        deleted += 1
      } catch {
        failed += 1
      }
    }
  }
  return { deleted, failed }
}

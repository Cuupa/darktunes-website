/**
 * src/lib/r2Utils.ts
 *
 * Server-side utility for downloading remote images and uploading them to
 * Cloudflare R2 — used by the sync pipeline to cache external artwork.
 *
 * Keeping this in its own module makes it easy to inject in tests.
 */

import { createHash } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'

/**
 * Creates a pre-configured S3Client pointed at the Cloudflare R2 endpoint.
 */
export function createR2Client(accountId: string, accessKeyId: string, secretAccessKey: string): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

/** Builds the public CDN URL for an R2 object key. */
export function buildR2PublicUrl(r2PublicUrl: string, key: string): string {
  return `${r2PublicUrl.replace(/\/$/, '')}/${key}`
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404
}

/**
 * Returns true when the object already exists in the bucket.
 */
export async function objectExistsInR2(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err) {
    if (isNotFoundError(err)) return false
    throw err
  }
}

/**
 * Downloads an image from `imageUrl` and uploads it to R2, returning the
 * public CDN URL.
 *
 * Objects are keyed by SHA-256 hash of the image bytes so repeated syncs
 * reuse the same R2 object instead of creating duplicates.
 *
 * @param imageUrl    - URL of the source image to download
 * @param s3          - Pre-configured S3Client for R2
 * @param bucket      - R2 bucket name
 * @param r2PublicUrl - Public CDN base URL for the bucket (e.g. https://cdn.darktunes.com)
 * @param keyPrefix   - Folder prefix for the R2 object key (e.g. 'cover-art')
 * @param fetchFn     - Injectable fetch implementation (defaults to global fetch)
 * @returns           - Public CDN URL of the uploaded object
 */
export async function uploadUrlToR2(
  imageUrl: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
  keyPrefix: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<string> {
  const resp = await fetchFn(imageUrl)
  if (!resp.ok) {
    throw new Error(`Failed to download image (${resp.status}): ${imageUrl}`)
  }

  const contentType = resp.headers.get('content-type') ?? 'image/jpeg'
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
  const buffer = Buffer.from(await resp.arrayBuffer())
  const hash = createHash('sha256').update(buffer).digest('hex')
  const key = `${keyPrefix}/${hash}.${ext}`
  const publicUrl = buildR2PublicUrl(r2PublicUrl, key)

  if (await objectExistsInR2(s3, bucket, key)) {
    return publicUrl
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return publicUrl
}

/**
 * Creates an uploadToR2 function wired to the given R2 credentials.
 * Used by sync route handlers to avoid duplicating R2 client setup.
 */
export function createSyncUploadFn(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucket: string,
  r2PublicUrl: string,
): (imageUrl: string, keyPrefix: string) => Promise<string> {
  const s3 = createR2Client(accountId, accessKeyId, secretAccessKey)
  return (imageUrl, keyPrefix) => uploadUrlToR2(imageUrl, s3, bucket, r2PublicUrl, keyPrefix)
}

/**
 * Deletes a single object from R2 by its key.
 *
 * @param r2Key - The object key to delete (e.g. 'uploads/uuid.jpg')
 * @param s3    - Pre-configured S3Client for R2
 * @param bucket - R2 bucket name
 */
export async function deleteObjectFromR2(
  r2Key: string,
  s3: S3Client,
  bucket: string,
): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: r2Key,
    }),
  )
}

/**
 * Downloads an R2 object body as UTF-8 text (for bronze CSV re-processing).
 */
export async function downloadObjectFromR2(
  r2Key: string,
  s3: S3Client,
  bucket: string,
): Promise<string> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: r2Key,
    }),
  )

  if (!response.Body) {
    throw new Error(`R2 object body empty: ${r2Key}`)
  }

  return response.Body.transformToString('utf-8')
}

/**
 * Downloads an R2 object body as raw bytes (for integrity checks).
 */
export async function downloadObjectBufferFromR2(
  r2Key: string,
  s3: S3Client,
  bucket: string,
): Promise<Uint8Array> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: r2Key,
    }),
  )

  if (!response.Body) {
    throw new Error(`R2 object body empty: ${r2Key}`)
  }

  return response.Body.transformToByteArray()
}

/**
 * Computes SHA-256 hex digest of an R2 object by streaming chunks (safe for large bronze CSVs).
 */
export async function sha256HexFromR2Object(
  r2Key: string,
  s3: S3Client,
  bucket: string,
): Promise<string> {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: r2Key,
    }),
  )

  if (!response.Body) {
    throw new Error(`R2 object body empty: ${r2Key}`)
  }

  const hash = createHash('sha256')
  const stream = response.Body as AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}
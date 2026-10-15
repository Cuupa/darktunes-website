import type { S3Client } from '@aws-sdk/client-s3'
import {
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getImportBatchById } from '@/lib/api/distributorImportBatches'
import { ApiError } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import type { Database } from '@/types/database'

export interface BronzeMultipartR2Context {
  s3: S3Client
  bucket: string
}

export interface BronzeMultipartPartRef {
  partNumber: number
  etag: string
}

export async function createBronzeMultipartR2Context(): Promise<BronzeMultipartR2Context> {
  const { serverEnv } = await import('@/lib/env.server')
  return {
    s3: createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    ),
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  }
}

/** Pending batches stay writable; only confirmed (`completed`) archives are locked. */
export async function getWritableImportBatch(
  supabase: SupabaseClient<Database>,
  batchId: string,
) {
  const batch = await getImportBatchById(supabase, batchId)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (batch.status === 'completed') {
    throw new ApiError(409, 'Import batch already has archived content')
  }
  return batch
}

export async function initBronzeMultipartUpload(
  ctx: BronzeMultipartR2Context,
  r2Key: string,
  contentType: string,
): Promise<string> {
  const result = await ctx.s3.send(
    new CreateMultipartUploadCommand({
      Bucket: ctx.bucket,
      Key: r2Key,
      ContentType: contentType,
    }),
  )
  if (!result.UploadId) throw new ApiError(500, 'Failed to start multipart upload')
  return result.UploadId
}

export async function completeBronzeMultipartUpload(
  ctx: BronzeMultipartR2Context,
  r2Key: string,
  uploadId: string,
  parts: BronzeMultipartPartRef[],
): Promise<void> {
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber)
  await ctx.s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: ctx.bucket,
      Key: r2Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }),
  )
}

export function buildConfirmedBronzeKey(batchId: string, stagingKey: string): string {
  const filename = stagingKey.split('/').at(-1) ?? `${batchId}.csv`
  return `sos-imports/${batchId}/confirmed/${filename}`
}

export async function copyBronzeObjectToConfirmedKey(
  ctx: BronzeMultipartR2Context,
  sourceKey: string,
  destinationKey: string,
): Promise<void> {
  const encodedSource = sourceKey.split('/').map(encodeURIComponent).join('/')
  await ctx.s3.send(
    new CopyObjectCommand({
      Bucket: ctx.bucket,
      CopySource: `${ctx.bucket}/${encodedSource}`,
      Key: destinationKey,
      MetadataDirective: 'COPY',
    }),
  )
}

export async function bronzeObjectExists(
  ctx: BronzeMultipartR2Context,
  key: string,
): Promise<boolean> {
  try {
    await ctx.s3.send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: key }))
    return true
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404 || (error as { name?: string }).name === 'NotFound') return false
    throw error
  }
}

export async function abortBronzeMultipartUpload(
  ctx: BronzeMultipartR2Context,
  r2Key: string,
  uploadId: string,
): Promise<void> {
  try {
    await ctx.s3.send(
      new AbortMultipartUploadCommand({
        Bucket: ctx.bucket,
        Key: r2Key,
        UploadId: uploadId,
      }),
    )
  } catch (error) {
    const name = (error as { name?: string }).name
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (name !== 'NoSuchUpload' && status !== 404) throw error
  }
}

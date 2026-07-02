/**
 * Server-side presigned URL generation for Bronze CSV direct upload/download (R2).
 * Browser PUT/GET bypasses Vercel 4.5 MB body limits; requires R2 bucket CORS.
 */

import { GetObjectCommand, PutObjectCommand, UploadPartCommand } from '@aws-sdk/client-s3'
import { createBronzeMultipartR2Context } from '@/lib/sos/bronzeMultipartUpload'

const BRONZE_UPLOAD_EXPIRY_SECONDS = 900
const BRONZE_DOWNLOAD_EXPIRY_SECONDS = 300

async function loadPresignDeps(): Promise<{
  ctx: Awaited<ReturnType<typeof createBronzeMultipartR2Context>>
  getSignedUrl: typeof import('@aws-sdk/s3-request-presigner').getSignedUrl
}> {
  const ctx = await createBronzeMultipartR2Context()
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  return { ctx, getSignedUrl }
}

export async function generateBronzePresignedPutUrl(
  r2Key: string,
  contentType: string,
): Promise<string> {
  const { ctx, getSignedUrl } = await loadPresignDeps()
  const command = new PutObjectCommand({
    Bucket: ctx.bucket,
    Key: r2Key,
    ContentType: contentType,
  })
  return getSignedUrl(ctx.s3, command, { expiresIn: BRONZE_UPLOAD_EXPIRY_SECONDS })
}

export async function generateBronzePresignedPartUrl(
  r2Key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const { ctx, getSignedUrl } = await loadPresignDeps()
  const command = new UploadPartCommand({
    Bucket: ctx.bucket,
    Key: r2Key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })
  return getSignedUrl(ctx.s3, command, { expiresIn: BRONZE_UPLOAD_EXPIRY_SECONDS })
}

export async function generateBronzePresignedDownloadUrl(r2Key: string): Promise<string> {
  const { ctx, getSignedUrl } = await loadPresignDeps()
  const command = new GetObjectCommand({
    Bucket: ctx.bucket,
    Key: r2Key,
  })
  return getSignedUrl(ctx.s3, command, { expiresIn: BRONZE_DOWNLOAD_EXPIRY_SECONDS })
}
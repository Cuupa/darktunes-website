/**
 * src/lib/r2Utils.ts
 *
 * Server-side utility for downloading remote images and uploading them to
 * Cloudflare R2 — used by the sync pipeline to cache external artwork.
 *
 * Keeping this in its own module makes it easy to inject in tests.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

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

/**
 * Downloads an image from `imageUrl` and uploads it to R2, returning the
 * public CDN URL.
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
  const key = `${keyPrefix}/${randomUUID()}.${ext}`

  const buffer = Buffer.from(await resp.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  )

  return `${r2PublicUrl.replace(/\/$/, '')}/${key}`
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

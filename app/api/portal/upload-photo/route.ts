/**
 * app/api/portal/upload-photo/route.ts
 *
 * Secure photo upload endpoint for Artist Portal profile photos.
 *
 * Flow:
 *   1. Verify the Bearer token via Supabase Auth (user must be authenticated)
 *   2. Confirm the artist_id belongs to the authenticated user
 *   3. Upload the image to Cloudflare R2 under `profile-photos/{artistId}/`
 *   4. Return the public CDN URL
 *
 * The file is never written to disk — it's streamed via ArrayBuffer → Buffer.
 * R2 credentials remain server-side; the client never touches R2 directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

async function uploadPhotoToR2(
  file: File,
  artistId: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<string> {
  const contentType = file.type || 'image/jpeg'
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
  const key = `profile-photos/${artistId}/${randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

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

  return `${r2PublicUrl.replace(/\/$/, '')}/${key}`
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = new URL(req.url).searchParams.get('artistId')
  const { artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  const maxBytes = 5 * 1024 * 1024 // 5 MB
  if (file.size > maxBytes) throw new ApiError(413, 'File too large (max 5 MB)')

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(415, 'Unsupported file type. Allowed: JPEG, PNG, WebP, GIF')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const url = await uploadPhotoToR2(
    file,
    artist.id,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  return NextResponse.json({ url })
})
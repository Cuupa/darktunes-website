import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

/** Submission covers are 3000×3000 JPEG; allow larger payloads than profile photos. */
const MAX_RELEASE_COVER_SIZE_BYTES = 15 * 1024 * 1024

async function uploadCoverToR2(
  file: File,
  artistId: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<string> {
  const contentType = 'image/jpeg'
  const key = `release-covers/${artistId}/${randomUUID()}.jpg`
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
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  if (file.size > MAX_RELEASE_COVER_SIZE_BYTES) {
    throw new ApiError(413, 'File too large (max 15 MB)')
  }

  // Submission covers must be JPEG (client validates 3000×3000 before upload)
  const typeOk =
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === '' // some browsers omit type; magic bytes checked below
  if (!typeOk) {
    throw new ApiError(415, 'Unsupported file type. Cover art must be JPEG/JPG')
  }

  const header = new Uint8Array(await file.slice(0, 3).arrayBuffer())
  if (!(header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)) {
    throw new ApiError(415, 'Cover art must be a JPEG file')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const url = await uploadCoverToR2(
    file,
    artist.id,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  return NextResponse.json({ url })
})
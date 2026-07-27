import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import {
  PORTAL_COVER_MIME,
  PORTAL_RELEASE_COVER_MAX_BYTES,
  PORTAL_UPLOAD_RATE,
} from '@/lib/uploads/portalUploadLimits'

async function uploadCoverToR2(
  file: File,
  artistId: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<string> {
  const contentType = file.type || 'image/jpeg'
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
  const key = `release-covers/${artistId}/${randomUUID()}.${ext}`
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
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { artist } = ctx

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `upload-release-cover:${ctx.user.id}:${ip}`,
    PORTAL_UPLOAD_RATE.max,
    PORTAL_UPLOAD_RATE.windowMs,
  )
  if (rl.limited) throw new ApiError(429, 'Too many uploads. Please wait and try again.')

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  if (file.size > PORTAL_RELEASE_COVER_MAX_BYTES) throw new ApiError(413, 'File too large (max 5 MB)')

  if (!PORTAL_COVER_MIME.has(file.type)) {
    throw new ApiError(415, 'Unsupported file type. Allowed: JPEG, PNG, WebP')
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
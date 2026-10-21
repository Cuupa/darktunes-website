/**
 * POST /api/portal/video-submission-thumbnails?artist_id=
 *
 * Upload one video thumbnail (JPEG/PNG/WebP, max 4 MB) to R2. Artists may
 * attach up to 3 URLs on submit-video.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import {
  PORTAL_COVER_MIME,
  PORTAL_UPLOAD_RATE,
  PORTAL_VIDEO_THUMBNAIL_MAX_BYTES,
} from '@/lib/uploads/portalUploadLimits'
import { formatUploadMb } from '@/lib/submissions/submissionAssets'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId =
    req.nextUrl.searchParams.get('artist_id') ?? req.nextUrl.searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `video-thumbnail:${ctx.user.id}:${ip}`,
    PORTAL_UPLOAD_RATE.max,
    PORTAL_UPLOAD_RATE.windowMs,
  )
  if (rl.limited) throw new ApiError(429, 'Too many uploads. Please wait and try again.')

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new ApiError(400, 'No thumbnail file was attached. Choose an image and try again.')
  }

  if (file.size > PORTAL_VIDEO_THUMBNAIL_MAX_BYTES) {
    throw new ApiError(
      413,
      `“${file.name}” is ${formatUploadMb(file.size)}; the maximum is ${formatUploadMb(PORTAL_VIDEO_THUMBNAIL_MAX_BYTES)}. Choose a smaller image.`,
    )
  }
  if (!PORTAL_COVER_MIME.has(file.type)) {
    throw new ApiError(
      415,
      `“${file.name}” is ${file.type || 'unknown type'}; thumbnails must be JPEG, PNG, or WebP.`,
    )
  }

  const { serverEnv } = await import('@/lib/env.server')
  const ext = file.type.split('/')[1]?.split(';')[0] ?? 'jpg'
  const key = `video-submissions/${ctx.artist.id}/${randomUUID()}.${ext}`
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const buffer = Buffer.from(await file.arrayBuffer())
  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const url = `${serverEnv.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  return NextResponse.json({ url }, { status: 201 })
})

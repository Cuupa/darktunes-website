/**
 * POST /api/portal/release-submission-assets
 *
 * Presign a private R2 PUT for submission audio or cover (≤ 32 MB audio, ≤ 5 MB JPEG cover).
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { createR2Client } from '@/lib/r2Utils'
import { PORTAL_UPLOAD_RATE } from '@/lib/uploads/portalUploadLimits'
import { createReleaseSubmissionAsset } from '@/lib/api/releaseSubmissionAssets'
import {
  assetsExpireAt,
  buildReleaseSubmissionAssetKey,
  formatUploadMb,
  isAllowedReleaseSubmissionAssetMime,
  releaseSubmissionAssetMaxBytes,
  type ReleaseSubmissionAssetKind,
} from '@/lib/submissions/submissionAssets'

const bodySchema = z.object({
  kind: z.enum(['audio', 'cover']),
  file_name: z.string().min(1).max(255),
  content_type: z.string().min(1).max(128),
  byte_size: z.number().int().positive(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { user, artist, serviceDb } = ctx

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `release-submission-asset:${user.id}:${ip}`,
    PORTAL_UPLOAD_RATE.max,
    PORTAL_UPLOAD_RATE.windowMs,
  )
  if (rl.limited) throw new ApiError(429, 'Too many uploads. Please wait and try again.')

  const body = bodySchema.parse(await req.json())
  const kind = body.kind as ReleaseSubmissionAssetKind
  const maxBytes = releaseSubmissionAssetMaxBytes(kind)

  if (!isAllowedReleaseSubmissionAssetMime(kind, body.content_type)) {
    throw new ApiError(
      415,
      kind === 'cover'
        ? `“${body.file_name}” is ${body.content_type}; cover art must be JPEG. Convert the file to JPEG 3000×3000.`
        : `“${body.file_name}” is ${body.content_type}; allowed audio is ZIP, WAV, FLAC, AIFF, or MP3. Choose a supported file.`,
    )
  }

  if (body.byte_size > maxBytes) {
    throw new ApiError(
      413,
      `“${body.file_name}” is ${formatUploadMb(body.byte_size)}; the maximum is ${formatUploadMb(maxBytes)}. Choose a smaller file.`,
    )
  }

  const { serverEnv } = await import('@/lib/env.server')
  const uploadId = randomUUID()
  const r2Key = buildReleaseSubmissionAssetKey(artist.id, uploadId, body.content_type)
  const expiresAt = assetsExpireAt()

  const asset = await createReleaseSubmissionAsset(serviceDb, {
    artist_id: artist.id,
    kind,
    r2_key: r2Key,
    content_type: body.content_type,
    byte_size: body.byte_size,
    expires_at: expiresAt,
  })

  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: body.content_type,
    }),
    { expiresIn: 900 },
  )

  return NextResponse.json(
    {
      id: asset.id,
      r2_key: r2Key,
      upload_url: uploadUrl,
      expires_at: expiresAt,
      content_type: body.content_type,
    },
    { status: 201 },
  )
})

/**
 * POST /api/portal/cover-art-check
 *
 * Server-side cover art verification for artist release submissions.
 * Avoids browser CORS failures on Google Drive and other hosts.
 * Returns a short-lived signed token on success so submit can skip re-download.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getClientIp } from '@/lib/ipRateLimit'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { createR2Client, downloadObjectBufferFromR2 } from '@/lib/r2Utils'
import { getReleaseSubmissionAssetByKey } from '@/lib/api/releaseSubmissionAssets'
import { inspectCoverArtBuffer, verifyCoverArtUrl } from '@/lib/submissions/coverArtCheck'
import { mintCoverArtToken } from '@/lib/submissions/coverArtToken'
import { isOwnedReleaseSubmissionKey, r2CoverTokenUrl } from '@/lib/submissions/submissionAssets'

const bodySchema = z
  .object({
    url: z.string().min(1).max(2048).optional(),
    r2_key: z.string().min(1).max(512).optional(),
  })
  .refine((value) => Boolean(value.url || value.r2_key), {
    message: 'url or r2_key is required',
  })

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { user, artist, serviceDb } = ctx

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(`cover-art-check:${user.id}:${ip}`, 30, 10 * 60_000)
  if (rl.limited) {
    throw new ApiError(429, 'Too many cover art checks. Please wait and try again.')
  }

  const body = bodySchema.parse(await req.json())
  const { serverEnv } = await import('@/lib/env.server')

  let result
  let tokenUrl: string

  if (body.r2_key) {
    if (!isOwnedReleaseSubmissionKey(body.r2_key, artist.id)) {
      throw new ApiError(403, 'That cover file does not belong to this artist. Upload the cover again.')
    }
    const asset = await getReleaseSubmissionAssetByKey(serviceDb, body.r2_key)
    if (!asset || asset.artistId !== artist.id || asset.kind !== 'cover') {
      throw new ApiError(404, 'Cover file was not found. Upload the JPEG again.')
    }
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )
    const bytes = await downloadObjectBufferFromR2(
      body.r2_key,
      s3,
      serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    )
    result = await inspectCoverArtBuffer(Buffer.from(bytes))
    tokenUrl = r2CoverTokenUrl(body.r2_key)
  } else {
    result = await verifyCoverArtUrl(body.url!, {
      r2PublicUrl: serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
    })
    tokenUrl = body.url!
  }

  if (!result.verified || result.width == null || result.height == null) {
    return NextResponse.json(result)
  }

  const token = mintCoverArtToken(serverEnv.API_CREDENTIALS_ENCRYPTION_KEY, {
    url: tokenUrl,
    width: result.width,
    height: result.height,
    format: result.format ?? 'jpeg',
  })

  return NextResponse.json({ ...result, token })
})

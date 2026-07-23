/**
 * POST /api/portal/cover-art-check
 *
 * Server-side cover art verification for artist release submissions.
 * Avoids browser CORS failures on Google Drive and other hosts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { verifyCoverArtUrl } from '@/lib/submissions/coverArtCheck'

const bodySchema = z.object({
  url: z.string().min(1).max(2048),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { user } = await authenticatePortalBearer(req)

  const ip = getClientIp(req)
  if (checkRateLimit(`cover-art-check:${user.id}:${ip}`, 30, 10 * 60_000).limited) {
    throw new ApiError(429, 'Too many cover art checks. Please wait and try again.')
  }

  const body = bodySchema.parse(await req.json())
  const { serverEnv } = await import('@/lib/env.server')

  const result = await verifyCoverArtUrl(body.url, {
    r2PublicUrl: serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  })

  return NextResponse.json(result)
})

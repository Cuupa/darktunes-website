/**
 * POST — Issue a short-lived preview token for draft Fan Page viewing.
 *
 * Membership via withPortalMembershipWrite (no DB write).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createFanPagePreviewToken, FAN_PAGE_PREVIEW_TOKEN_TTL_MS } from '@/lib/fan-page/previewToken'
import { getPublicFanPagePath } from '@/lib/fan-page/urls'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json())
  const { artist } = await withPortalMembershipWrite(req, body.artist_id)

  const token = createFanPagePreviewToken(artist.id, artist.slug)
  const previewPath = `${getPublicFanPagePath(artist.slug)}?preview=${encodeURIComponent(token)}`

  return NextResponse.json({
    token,
    previewPath,
    expiresInMs: FAN_PAGE_PREVIEW_TOKEN_TTL_MS,
  })
})

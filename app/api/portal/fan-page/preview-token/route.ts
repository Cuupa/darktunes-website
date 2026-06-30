/**
 * POST — Issue a short-lived preview token for draft Fan Page viewing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createFanPagePreviewToken, FAN_PAGE_PREVIEW_TOKEN_TTL_MS } from '@/lib/fan-page/previewToken'
import { getPublicFanPagePath } from '@/lib/fan-page/urls'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const body = bodySchema.parse(await req.json())

  const artist = await resolvePortalArtist(supabase, user.id, body.artist_id).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const token = createFanPagePreviewToken(artist.id, artist.slug)
  const previewPath = `${getPublicFanPagePath(artist.slug)}?preview=${encodeURIComponent(token)}`

  return NextResponse.json({
    token,
    previewPath,
    expiresInMs: FAN_PAGE_PREVIEW_TOKEN_TTL_MS,
  })
})
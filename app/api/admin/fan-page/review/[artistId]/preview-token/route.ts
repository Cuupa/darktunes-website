/**
 * GET /api/admin/fan-page/review/[artistId]/preview-token — short-lived fan page preview link
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createFanPagePreviewToken,
  FAN_PAGE_PREVIEW_TOKEN_TTL_MS,
} from '@/lib/fan-page/previewToken'
import { getPublicFanPagePath } from '@/lib/fan-page/urls'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const artistId = req.nextUrl.pathname.split('/').slice(-2)[0]
  if (!artistId || artistId === 'review') throw new ApiError(400, 'Missing artist id')

  const supabase = await createServerSupabaseClient()
  const { data: artist, error } = await supabase
    .from('artists')
    .select('id, slug')
    .eq('id', artistId)
    .maybeSingle()

  if (error) throw new ApiError(500, error.message)
  if (!artist) throw new ApiError(404, 'Artist not found')

  const previewToken = createFanPagePreviewToken(artist.id, artist.slug)
  const previewPath = `${getPublicFanPagePath(artist.slug)}?preview=${encodeURIComponent(previewToken)}`

  return NextResponse.json({
    previewPath,
    expiresInMs: FAN_PAGE_PREVIEW_TOKEN_TTL_MS,
  })
})
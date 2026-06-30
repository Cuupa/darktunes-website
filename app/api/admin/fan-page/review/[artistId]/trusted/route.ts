/**
 * PATCH /api/admin/fan-page/review/[artistId]/trusted — toggle direct fan page publish
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { setArtistLandingPublishTrusted } from '@/lib/api/fanPageDocument'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  trusted: z.boolean(),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const artistId = req.nextUrl.pathname.split('/').slice(-2)[0]
  if (!artistId || artistId === 'review') throw new ApiError(400, 'Missing artist id')

  const body = bodySchema.parse(await req.json())
  const supabase = await createServerSupabaseClient()

  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .maybeSingle()

  if (artistError) throw new ApiError(500, artistError.message)
  if (!artist) throw new ApiError(404, 'Artist not found')

  await setArtistLandingPublishTrusted(supabase, artistId, body.trusted)

  return NextResponse.json({ artistId, landingPublishTrusted: body.trusted })
})
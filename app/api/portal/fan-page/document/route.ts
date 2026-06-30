/**
 * GET/PUT — Fan Page document load/save
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import {
  getArtistProfileByArtistId,
  resolvePortalArtist,
} from '@/lib/api/artistProfiles'
import { getFanPageDocumentState, saveFanPageDocument } from '@/lib/api/fanPageDocument'
import { landingPageDocumentV1Schema } from '@/lib/fan-page/schema/documentV1'

const putBodySchema = z.object({
  artist_id: z.string().uuid(),
  document: landingPageDocumentV1Schema,
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')
  const templateId = new URL(req.url).searchParams.get('templateId') ?? 'dark-minimal'

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const profile = await getArtistProfileByArtistId(supabase, artist.id)
  const state = await getFanPageDocumentState(supabase, artist.id, artist, profile, templateId)

  return NextResponse.json(state)
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const body = putBodySchema.parse(await req.json())

  const artist = await resolvePortalArtist(supabase, user.id, body.artist_id).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const state = await saveFanPageDocument(supabase, artist.id, body.document)

  return NextResponse.json(state)
})
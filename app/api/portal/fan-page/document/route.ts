/**
 * GET/PUT — Fan Page document load/save
 *
 * Membership is verified with the bearer client; document reads/writes use
 * service-role so band members are not blocked by legacy RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  getArtistProfileByArtistId,
  resolvePortalArtist,
} from '@/lib/api/artistProfiles'
import { getFanPageDocumentState, saveFanPageDocument } from '@/lib/api/fanPageDocument'
import { landingPageDocumentV1Schema } from '@/lib/fan-page/schema/documentV1'
import { portalMemberWrite, withPortalMembership } from '@/lib/portal/withPortalMembership'

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

  const serviceDb = await createServiceRoleSupabaseClient()
  const profile = await getArtistProfileByArtistId(serviceDb, artist.id)
  const state = await getFanPageDocumentState(serviceDb, artist.id, artist, profile, templateId)

  return NextResponse.json(state)
})

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const body = putBodySchema.parse(await req.json())
  const ctx = await withPortalMembership(req, body.artist_id)

  const { value: state } = await portalMemberWrite(
    ctx,
    {
      route: 'PUT /api/portal/fan-page/document',
      table: 'artist_landing_pages',
      operation: 'upsert',
    },
    (db) => saveFanPageDocument(db, ctx.artist.id, body.document),
  )

  return NextResponse.json(state)
})

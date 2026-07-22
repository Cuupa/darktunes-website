/**
 * app/api/portal/epk/document/route.ts
 *
 * GET  — load EPK canvas document (auto-migrates legacy presets on first access)
 * PUT  — save EPK canvas document
 *
 * Membership is verified with the bearer client; artist_epks reads/writes then
 * use the service-role client so band members are not blocked by legacy RLS.
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
import { ensureMigratedEpkDocument, saveEpkDocument } from '@/lib/api/epkDocument'
import { epkDocumentV2Schema } from '@/lib/epk/schema/documentV2'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { emptyArtistProfile } from '@/lib/epk/migrate/emptyArtistProfile'
import { portalWriteWithCanary } from '@/lib/portal/portalWriteClient'

const putBodySchema = z.object({
  artist_id: z.string().uuid(),
  document: epkDocumentV2Schema,
  create_version: z.boolean().optional(),
  version_label: z.string().max(200).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const serviceDb = await createServiceRoleSupabaseClient()
  const profile = await getArtistProfileByArtistId(serviceDb, artist.id)
  const siteSettings = await getCachedSiteSettings().catch(() => null)

  const state = await ensureMigratedEpkDocument(
    serviceDb,
    artist.id,
    profile ?? emptyArtistProfile(artist.id),
    artist,
    siteSettings?.labelName ?? undefined,
  )

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

  const serviceDb = await createServiceRoleSupabaseClient()
  const { value: state } = await portalWriteWithCanary({
    userDb: supabase,
    serviceDb,
    context: {
      route: 'PUT /api/portal/epk/document',
      table: 'artist_epks',
      operation: 'upsert',
      artistId: artist.id,
      userId: user.id,
    },
    write: (db) =>
      saveEpkDocument(db, artist.id, body.document, user.id, {
        createVersion: body.create_version,
        versionLabel: body.version_label,
      }),
  })

  return NextResponse.json(state)
})

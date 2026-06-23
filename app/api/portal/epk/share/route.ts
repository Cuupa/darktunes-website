/**
 * app/api/portal/epk/share/route.ts
 *
 * GET    — list share links for an artist
 * POST   — create a new share link
 * DELETE — revoke a share link (?id=&artist_id=)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import {
  createEpkShareLink,
  listEpkShareLinks,
  revokeEpkShareLink,
} from '@/lib/api/epkShareLinks'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

const createSchema = z.object({
  artist_id: z.string().uuid(),
  label: z.string().max(120).optional(),
  password: z.string().min(4).max(200).optional(),
  expires_at: z
    .string()
    .datetime()
    .optional()
    .refine((value) => !value || new Date(value).getTime() > Date.now(), {
      message: 'expires_at must be in the future',
    }),
})

async function resolveArtistForUser(
  req: NextRequest,
  artistId: string,
) {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')
  return { supabase, user, artist }
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!artistId) throw new ApiError(400, 'artist_id is required')

  const { supabase, artist } = await resolveArtistForUser(req, artistId)
  const links = await listEpkShareLinks(supabase, artist.id)
  return NextResponse.json({ links })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = createSchema.parse(await req.json())
  const { supabase, user, artist } = await resolveArtistForUser(req, body.artist_id)

  const link = await createEpkShareLink(supabase, {
    artistId: artist.id,
    createdBy: user.id,
    label: body.label,
    password: body.password,
    expiresAt: body.expires_at,
  })

  return NextResponse.json({ link })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const linkId = req.nextUrl.searchParams.get('id')
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!linkId || !artistId) throw new ApiError(400, 'id and artist_id are required')

  const { supabase, artist } = await resolveArtistForUser(req, artistId)
  await revokeEpkShareLink(supabase, artist.id, linkId)
  return NextResponse.json({ success: true })
})
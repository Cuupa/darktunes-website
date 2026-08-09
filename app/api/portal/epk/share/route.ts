/**
 * app/api/portal/epk/share/route.ts
 *
 * GET    — list share links for an artist
 * POST   — create a new share link
 * DELETE — revoke a share link (?id=&artist_id=)
 *
 * Membership via withPortalMembershipWrite; CRUD via portalMemberWrite.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  createEpkShareLink,
  listEpkShareLinks,
  revokeEpkShareLink,
} from '@/lib/api/epkShareLinks'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

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

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!artistId) throw new ApiError(400, 'artist_id is required')

  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: links } = await portalMemberWrite(
    ctx,
    { route: 'GET /api/portal/epk/share', table: 'epk_share_links', operation: 'select' },
    (db) => listEpkShareLinks(db, ctx.artist.id),
  )
  return NextResponse.json({ links })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = createSchema.parse(await req.json())
  const ctx = await withPortalMembershipWrite(req, body.artist_id)

  const { value: link } = await portalMemberWrite(
    ctx,
    { route: 'POST /api/portal/epk/share', table: 'epk_share_links', operation: 'insert' },
    (db) =>
      createEpkShareLink(db, {
        artistId: ctx.artist.id,
        createdBy: ctx.user.id,
        label: body.label,
        password: body.password,
        expiresAt: body.expires_at,
      }),
  )

  return NextResponse.json({ link })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const linkId = req.nextUrl.searchParams.get('id')
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!linkId || !artistId) throw new ApiError(400, 'id and artist_id are required')

  const ctx = await withPortalMembershipWrite(req, artistId)
  await portalMemberWrite(
    ctx,
    { route: 'DELETE /api/portal/epk/share', table: 'epk_share_links', operation: 'delete' },
    (db) => revokeEpkShareLink(db, ctx.artist.id, linkId),
  )
  return NextResponse.json({ success: true })
})

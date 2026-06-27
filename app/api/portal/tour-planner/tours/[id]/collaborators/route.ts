import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  addTourCollaborator,
  getTourCollaborators,
  removeTourCollaborator,
} from '@/lib/api/tourCollaborators'
import {
  authenticateTourPlannerRequest,
  assertTourAccess,
  assertTourOwner,
} from '@/lib/portal/tourPlannerAuth'

const addSchema = z.object({
  collaboratorArtistId: z.string().uuid(),
})

function tourIdFromPath(pathname: string): string {
  const parts = pathname.split('/')
  const idx = parts.indexOf('tours')
  const id = idx >= 0 ? parts[idx + 1] : null
  if (!id) throw new ApiError(400, 'Missing tour id')
  return id
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const tourId = tourIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  await assertTourAccess(supabase, tourId, artist.id)

  const collaborators = await getTourCollaborators(supabase, tourId)
  return NextResponse.json({ collaborators })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const tourId = tourIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist, user } = await authenticateTourPlannerRequest(req, artistId)
  await assertTourOwner(supabase, tourId, artist.id)

  const body = addSchema.parse(await req.json())
  if (body.collaboratorArtistId === artist.id) {
    throw new ApiError(400, 'Cannot add tour owner as collaborator')
  }

  const { data: rosterArtist, error: rosterError } = await supabase
    .from('artists')
    .select('id')
    .eq('id', body.collaboratorArtistId)
    .maybeSingle()
  if (rosterError) throw new ApiError(500, rosterError.message)
  if (!rosterArtist) throw new ApiError(404, 'Artist not found on roster')

  await addTourCollaborator(supabase, tourId, body.collaboratorArtistId, user.id)
  const collaborators = await getTourCollaborators(supabase, tourId)
  return NextResponse.json({ collaborators }, { status: 201 })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const tourId = tourIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const collaboratorArtistId = req.nextUrl.searchParams.get('collaboratorArtistId')
  if (!collaboratorArtistId) throw new ApiError(400, 'collaboratorArtistId is required')

  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  await assertTourOwner(supabase, tourId, artist.id)

  await removeTourCollaborator(supabase, tourId, collaboratorArtistId)
  const collaborators = await getTourCollaborators(supabase, tourId)
  return NextResponse.json({ collaborators })
})
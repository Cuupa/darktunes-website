import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourCrewMember, updateTourCrewMember } from '@/lib/api/tourCrew'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  passportExpiry: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  visaInfo: z.string().nullable().optional(),
  roomAssignment: z.string().nullable().optional(),
  busAssignment: z.string().nullable().optional(),
})

function crewId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing crew id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = crewId(req.nextUrl.pathname)
  const body = patchSchema.parse(await req.json())

  const { data, error } = await supabase.from('tour_crew_members').select('artist_id').eq('id', id).single()
  if (error || !data || data.artist_id !== artist.id) throw new ApiError(404, 'Crew member not found')

  const member = await updateTourCrewMember(supabase, id, {
    name: body.name,
    role: body.role,
    email: body.email,
    phone: body.phone,
    passport_number: body.passportNumber,
    passport_expiry: body.passportExpiry,
    nationality: body.nationality,
    visa_info: body.visaInfo,
    room_assignment: body.roomAssignment,
    bus_assignment: body.busAssignment,
  })
  return NextResponse.json({ member })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = crewId(req.nextUrl.pathname)

  const { data, error } = await supabase.from('tour_crew_members').select('artist_id').eq('id', id).single()
  if (error || !data || data.artist_id !== artist.id) throw new ApiError(404, 'Crew member not found')

  await deleteTourCrewMember(supabase, id)
  return NextResponse.json({ ok: true })
})
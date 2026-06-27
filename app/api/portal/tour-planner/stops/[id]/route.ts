import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourStop, getTourStopById, updateTourStop } from '@/lib/api/tourStops'
import { publishTourStopAsConcert, syncLinkedConcertFromStop } from '@/lib/api/tourConcertBridge'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'
import { showStatusSchema } from '@/lib/tour-planner/validation'

const updateSchema = z.object({
  stopDate: z.string().optional(),
  isTravelDay: z.boolean().optional(),
  venueName: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  venueLat: z.number().nullable().optional(),
  venueLng: z.number().nullable().optional(),
  venueValidated: z.boolean().optional(),
  hotelName: z.string().nullable().optional(),
  hotelAddress: z.string().nullable().optional(),
  hotelCity: z.string().nullable().optional(),
  hotelCountry: z.string().nullable().optional(),
  hotelLat: z.number().nullable().optional(),
  hotelLng: z.number().nullable().optional(),
  hotelValidated: z.boolean().optional(),
  arrivalTime: z.string().nullable().optional(),
  showStatus: showStatusSchema.optional(),
  daySchedule: z.record(z.string(), z.unknown()).nullable().optional(),
  deal: z.record(z.string(), z.unknown()).nullable().optional(),
  settlement: z.record(z.string(), z.unknown()).nullable().optional(),
  perDiems: z.array(z.record(z.string(), z.unknown())).optional(),
  rooming: z.array(z.record(z.string(), z.unknown())).optional(),
  travelManifest: z.array(z.record(z.string(), z.unknown())).optional(),
  venueDetails: z.record(z.string(), z.unknown()).nullable().optional(),
  venueContactInfo: z.record(z.string(), z.unknown()).nullable().optional(),
  guestList: z.array(z.record(z.string(), z.unknown())).optional(),
  guestListLimit: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  publishConcert: z.boolean().optional(),
  eventName: z.string().optional(),
  syncConcert: z.boolean().optional(),
})

function stopIdFromPath(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing stop id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const id = stopIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist, user } = await authenticateTourPlannerRequest(req, artistId)
  const body = updateSchema.parse(await req.json())

  const existing = await getTourStopById(supabase, id)
  if (!existing || existing.artistId !== artist.id) {
    throw new ApiError(404, 'Tour stop not found')
  }

  const stop = await updateTourStop(supabase, id, {
    stop_date: body.stopDate,
    is_travel_day: body.isTravelDay,
    venue_name: body.venueName,
    venue_address: body.venueAddress,
    venue_city: body.venueCity,
    venue_country: body.venueCountry,
    venue_lat: body.venueLat,
    venue_lng: body.venueLng,
    venue_validated: body.venueValidated,
    hotel_name: body.hotelName,
    hotel_address: body.hotelAddress,
    hotel_city: body.hotelCity,
    hotel_country: body.hotelCountry,
    hotel_lat: body.hotelLat,
    hotel_lng: body.hotelLng,
    hotel_validated: body.hotelValidated,
    arrival_time: body.arrivalTime,
    show_status: body.showStatus,
    day_schedule: body.daySchedule as Json | null | undefined,
    deal: body.deal as Json | null | undefined,
    settlement: body.settlement as Json | null | undefined,
    per_diems: body.perDiems as Json | undefined,
    rooming: body.rooming as Json | undefined,
    travel_manifest: body.travelManifest as Json | undefined,
    venue_details: body.venueDetails as Json | null | undefined,
    venue_contact_info: body.venueContactInfo as Json | null | undefined,
    guest_list: body.guestList as Json | undefined,
    guest_list_limit: body.guestListLimit,
    notes: body.notes,
  })

  let concert = null
  if (body.publishConcert) {
    concert = await publishTourStopAsConcert(supabase, stop, user.id, body.eventName)
  } else if (body.syncConcert && stop.concertId) {
    concert = await syncLinkedConcertFromStop(supabase, stop)
  }

  return NextResponse.json({ stop, concert })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const id = stopIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)

  const existing = await getTourStopById(supabase, id)
  if (!existing || existing.artistId !== artist.id) {
    throw new ApiError(404, 'Tour stop not found')
  }

  await deleteTourStop(supabase, id)
  return NextResponse.json({ ok: true })
})
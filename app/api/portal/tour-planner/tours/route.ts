import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler } from '@/lib/errors'
import { createTour, getToursByArtistId } from '@/lib/api/tours'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'
import { DEFAULT_TOUR_PLANNER_SETTINGS } from '@/lib/tour-planner/types'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  currency: z.string().default('EUR'),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'
  const tours = await getToursByArtistId(supabase, artist.id, includeArchived)
  return NextResponse.json({ tours })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist, user } = await authenticateTourPlannerRequest(req, artistId)
  const body = createSchema.parse(await req.json())

  const tour = await createTour(supabase, {
    artist_id: artist.id,
    name: body.name,
    description: body.description ?? null,
    start_date: body.startDate ?? null,
    end_date: body.endDate ?? null,
    currency: body.currency,
    settings: DEFAULT_TOUR_PLANNER_SETTINGS as unknown as Json,
    created_by: user.id,
  })

  return NextResponse.json({ tour }, { status: 201 })
})
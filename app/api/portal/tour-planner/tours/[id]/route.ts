import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTour, duplicateTour, getTourById, getToursByArtistId, updateTour } from '@/lib/api/tours'
import { upsertTourArtistFinance } from '@/lib/api/tourArtistFinance'
import type { TourBudget } from '@/lib/tour-planner/types'
import {
  authenticateTourPlannerRequest,
  assertTourAccess,
  assertTourOwner,
} from '@/lib/portal/tourPlannerAuth'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  routeCache: z.record(z.string(), z.unknown()).nullable().optional(),
  budget: z.record(z.string(), z.unknown()).nullable().optional(),
  techDocuments: z.array(z.record(z.string(), z.unknown())).optional(),
  currency: z.string().optional(),
  totalBudget: z.number().nullable().optional(),
  expectedFinanceUpdatedAt: z.string().nullable().optional(),
  duplicate: z.boolean().optional(),
})

function tourIdFromPath(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing tour id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const id = tourIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist, user } = await authenticateTourPlannerRequest(req, artistId)
  const body = updateSchema.parse(await req.json())

  const existing = await getTourById(supabase, id)
  if (!existing) throw new ApiError(404, 'Tour not found')

  if (body.duplicate) {
    await assertTourOwner(supabase, id, artist.id)
    const copy = await duplicateTour(supabase, id, user.id)
    return NextResponse.json({ tour: copy })
  }

  await assertTourAccess(supabase, id, artist.id)

  if (
    body.budget !== undefined
    || body.totalBudget !== undefined
    || body.currency !== undefined
  ) {
    await upsertTourArtistFinance(
      supabase,
      id,
      artist.id,
      {
        budget: body.budget as TourBudget | null | undefined,
        totalBudget: body.totalBudget,
        currency: body.currency,
      },
      body.expectedFinanceUpdatedAt ?? undefined,
    )
  }

  const tour = await updateTour(supabase, id, {
    name: body.name,
    description: body.description,
    start_date: body.startDate,
    end_date: body.endDate,
    archived: body.archived,
    settings: body.settings as Json | undefined,
    route_cache: body.routeCache as Json | null | undefined,
    tech_documents: body.techDocuments as Json | undefined,
  })

  const enriched = (await getToursByArtistId(supabase, artist.id, true)).find((t) => t.id === tour.id)
  return NextResponse.json({ tour: enriched ?? tour })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const id = tourIdFromPath(req.nextUrl.pathname)
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)

  await assertTourOwner(supabase, id, artist.id)
  await deleteTour(supabase, id)
  return NextResponse.json({ ok: true })
})
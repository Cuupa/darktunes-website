import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getTourStopById } from '@/lib/api/tourStops'
import { getTourMerchSettlementByStopId, upsertTourMerchSettlement } from '@/lib/api/tourMerch'
import { authenticateTourPlannerRequest, assertTourAccess } from '@/lib/portal/tourPlannerAuth'
import type { MerchSettlement } from '@/lib/tour-planner/types'

const postSchema = z.object({
  stopId: z.string().uuid(),
  settlement: z.record(z.string(), z.unknown()),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const stopId = req.nextUrl.searchParams.get('stopId')
  if (!stopId) throw new ApiError(400, 'stopId is required')

  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const stop = await getTourStopById(supabase, stopId)
  if (!stop) throw new ApiError(404, 'Stop not found')
  await assertTourAccess(supabase, stop.tourId, artist.id)

  const record = await getTourMerchSettlementByStopId(supabase, stopId, artist.id)
  return NextResponse.json({ record })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = postSchema.parse(await req.json())
  const stop = await getTourStopById(supabase, body.stopId)
  if (!stop) throw new ApiError(404, 'Stop not found')
  await assertTourAccess(supabase, stop.tourId, artist.id)
  const record = await upsertTourMerchSettlement(
    supabase,
    body.stopId,
    artist.id,
    body.settlement as unknown as MerchSettlement,
  )
  return NextResponse.json({ record })
})
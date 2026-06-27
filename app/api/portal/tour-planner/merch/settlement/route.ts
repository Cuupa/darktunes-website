import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getTourStopById } from '@/lib/api/tourStops'
import { upsertTourMerchSettlement } from '@/lib/api/tourMerch'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import type { MerchSettlement } from '@/lib/tour-planner/types'

const schema = z.object({
  stopId: z.string().uuid(),
  settlement: z.record(z.string(), z.unknown()),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = schema.parse(await req.json())
  const stop = await getTourStopById(supabase, body.stopId)
  if (!stop || stop.artistId !== artist.id) throw new ApiError(404, 'Stop not found')
  const record = await upsertTourMerchSettlement(supabase, body.stopId, artist.id, body.settlement as unknown as MerchSettlement)
  return NextResponse.json({ record })
})
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler } from '@/lib/errors'
import { createTourMerchItem, getTourMerchItemsByArtistId } from '@/lib/api/tourMerch'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['soft', 'hard']).default('soft'),
  basePrice: z.number().default(0),
  currency: z.string().default('EUR'),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const items = await getTourMerchItemsByArtistId(supabase, artist.id)
  return NextResponse.json({ items })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = createSchema.parse(await req.json())
  const item = await createTourMerchItem(supabase, {
    artist_id: artist.id,
    sku: body.sku,
    name: body.name,
    category: body.category,
    base_price: body.basePrice,
    currency: body.currency,
    variants: [] as Json,
  })
  return NextResponse.json({ item }, { status: 201 })
})
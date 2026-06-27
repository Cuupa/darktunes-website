import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler } from '@/lib/errors'
import { createTourMerchItem, getTourMerchItemsByArtistId } from '@/lib/api/tourMerch'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const variantSchema = z.object({
  id: z.string(),
  type: z.enum(['size', 'color', 'format']),
  value: z.string(),
  stock: z.number(),
})

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['soft', 'hard']).default('soft'),
  basePrice: z.number().default(0),
  currency: z.string().default('EUR'),
  variants: z.array(variantSchema).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const items = await getTourMerchItemsByArtistId(supabase, artist.id)
  return NextResponse.json({ items })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = createSchema.parse(await req.json())
  const item = await createTourMerchItem(supabase, {
    artist_id: artist.id,
    sku: body.sku,
    name: body.name,
    category: body.category,
    base_price: body.basePrice,
    currency: body.currency,
    variants: (body.variants ?? []) as Json,
  })
  return NextResponse.json({ item }, { status: 201 })
})
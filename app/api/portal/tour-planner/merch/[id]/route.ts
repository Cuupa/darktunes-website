import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourMerchItem, updateTourMerchItem } from '@/lib/api/tourMerch'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const patchSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.enum(['soft', 'hard']).optional(),
  basePrice: z.number().optional(),
  currency: z.string().optional(),
  variants: z.array(z.object({
    id: z.string(),
    type: z.enum(['size', 'color', 'format']),
    value: z.string(),
    stock: z.number(),
  })).optional(),
})

function merchId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing merch id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = merchId(req.nextUrl.pathname)
  const body = patchSchema.parse(await req.json())

  const { data, error } = await supabase.from('tour_merch_items').select('id').eq('id', id).eq('artist_id', artist.id).maybeSingle()
  if (error || !data) throw new ApiError(404, 'Merch item not found')

  const item = await updateTourMerchItem(supabase, id, {
    sku: body.sku,
    name: body.name,
    category: body.category,
    base_price: body.basePrice,
    currency: body.currency,
    variants: body.variants as unknown as Json,
  })
  return NextResponse.json({ item })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = merchId(req.nextUrl.pathname)

  const { data, error } = await supabase.from('tour_merch_items').select('id').eq('id', id).eq('artist_id', artist.id).maybeSingle()
  if (error || !data) throw new ApiError(404, 'Merch item not found')

  await deleteTourMerchItem(supabase, id)
  return NextResponse.json({ ok: true })
})
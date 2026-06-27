import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) throw new ApiError(400, 'Query must be at least 2 characters')

  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)

  const { data, error } = await supabase
    .from('artists')
    .select('id, name, slug')
    .eq('is_visible', true)
    .neq('id', artist.id)
    .ilike('name', `%${q}%`)
    .order('name', { ascending: true })
    .limit(20)

  if (error) throw new ApiError(500, error.message)
  return NextResponse.json({ artists: data ?? [] })
})
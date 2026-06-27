import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const schema = z.object({
  query: z.string().min(1),
})

const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? 'darktunes-tour-planner/1.0'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  await authenticatePortalBearerWithArtist(req, artistId)
  const body = schema.parse(await req.json())

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(body.query)}&format=json&limit=1`
  const response = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    next: { revalidate: 86400 },
  })

  if (!response.ok) {
    return NextResponse.json({ coords: null, error: 'Geocoding service unavailable' })
  }

  const results = (await response.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>

  if (!results.length) {
    return NextResponse.json({ coords: null, error: 'Address not found' })
  }

  const [first] = results
  return NextResponse.json({
    coords: { lat: Number(first.lat), lon: Number(first.lon) },
    displayName: first.display_name,
  })
})
/**
 * app/api/admin/sync-artist-bandsintown/route.ts
 *
 * POST /api/admin/sync-artist-bandsintown
 * Body: { artistId: string; bandsintownId: string; bandsintownApiKey: string }
 * Auth: ****** (admin or editor role required)
 *
 * Runs a one-off Bandsintown concert sync for a single artist using the
 * credentials supplied in the request body. This allows admins to test and
 * refresh Bandsintown data for a specific artist without waiting for the
 * global cron sync to run.
 *
 * Returns: { concertsUpserted: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { fetchBandsintownArtistEvents } from '@/lib/sync/bandsintownApi'
import type { Database } from '@/types/database'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_manage_artists')

  let artistId: string | undefined
  let bandsintownId: string | undefined
  let bandsintownApiKey: string | undefined

  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>
      if (typeof b.artistId === 'string') artistId = b.artistId.trim()
      if (typeof b.bandsintownId === 'string') bandsintownId = b.bandsintownId.trim()
      if (typeof b.bandsintownApiKey === 'string') bandsintownApiKey = b.bandsintownApiKey.trim()
    }
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!artistId) throw new ApiError(400, 'Missing required field: artistId')
  if (!bandsintownId) throw new ApiError(400, 'Missing required field: bandsintownId')
  if (!bandsintownApiKey) throw new ApiError(400, 'Missing required field: bandsintownApiKey')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new ApiError(500, 'Supabase service key not configured')

  const db = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Verify the artist exists
  const { data: artist, error: artistErr } = await db
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .single()

  if (artistErr || !artist) throw new ApiError(404, 'Artist not found')

  let concerts
  try {
    concerts = await fetchBandsintownArtistEvents(bandsintownId, bandsintownApiKey, globalThis.fetch)
  } catch (e) {
    const msg = String(e)
    if (msg.includes('401') || msg.includes('403')) {
      throw new ApiError(400, 'Bandsintown API key is invalid or unauthorised')
    }
    throw new ApiError(502, `Bandsintown API error: ${msg}`)
  }

  if (concerts.length === 0) {
    return NextResponse.json({ concertsUpserted: 0 })
  }

  const concertsData = concerts.map((concert) => ({
    artist_id: artistId as string,
    event_name: concert.eventName,
    venue_name: concert.venueName,
    venue_city: concert.venueCity,
    venue_country: concert.venueCountry,
    concert_date: concert.concertDate,
    ticket_url: concert.ticketUrl,
    bandsintown_id: concert.bandsintownId,
    status: concert.status,
  }))

  const { error: upsertErr } = await db
    .from('concerts')
    .upsert(concertsData, { onConflict: 'bandsintown_id' })

  if (upsertErr) throw new ApiError(500, `Failed to save concerts: ${upsertErr.message}`)

  return NextResponse.json({ concertsUpserted: concerts.length })
})

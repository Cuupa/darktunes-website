/**
 * app/api/portal/concerts/ics/route.ts
 *
 * Returns all upcoming concerts for the authenticated artist as an ICS
 * (iCalendar) file that can be imported into any calendar application.
 *
 * GET /api/portal/concerts/ics  (Bearer token required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import type { Concert } from '@/types'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

/** Escape special characters in iCalendar text values. */
function icsEscape(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Format a Date as a UTC YYYYMMDDTHHMMSSZ string for iCalendar. */
function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Build an iCalendar VEVENT block for a concert. */
function buildVEvent(concert: Concert): string {
  const dtStamp = icsDate(new Date())

  let dtStart: string
  if (concert.eventTime) {
    const [h, m] = concert.eventTime.split(':')
    const d = new Date(`${concert.concertDate}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00Z`)
    dtStart = `DTSTART:${icsDate(d)}`
  } else {
    const dateOnly = concert.concertDate.slice(0, 10).replace(/-/g, '')
    dtStart = `DTSTART;VALUE=DATE:${dateOnly}`
  }

  const location = [concert.venueName, concert.venueCity, concert.venueCountry]
    .filter(Boolean)
    .join(', ')

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${concert.id}@darktunes`,
    `DTSTAMP:${dtStamp}`,
    dtStart,
    `SUMMARY:${icsEscape(concert.eventName)}`,
  ]
  if (location) lines.push(`LOCATION:${icsEscape(location)}`)
  if (concert.ticketUrl) lines.push(`URL:${concert.ticketUrl}`)
  if (concert.trailerUrl) lines.push(`DESCRIPTION:Trailer: ${icsEscape(concert.trailerUrl)}`)
  if (concert.status === 'cancelled') lines.push('STATUS:CANCELLED')
  lines.push('END:VEVENT')

  return lines.join('\r\n')
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const concerts = await getConcertsByArtistId(supabase, artist.id)

  const prodId = `-//darkTunes//Artist Portal//EN`
  const vEvents = concerts.map((c) => buildVEvent(c)).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(artist.name)} – Events`,
    vEvents,
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  const safeSlug = (artist.slug ?? artist.name).replace(/[^a-z0-9-]/gi, '_')
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeSlug}-events.ics"`,
      'Cache-Control': 'no-store',
    },
  })
})
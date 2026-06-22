'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  NavigationArrow,
  Newspaper,
  ArrowLeft,
  Users,
} from '@phosphor-icons/react'
import { ConsentGate } from '@/components/ConsentGate'
import { ShareButton } from '@/components/ShareButton'
import type { Concert } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface EventDetailContentProps {
  concert: Concert
  dict: Dictionary
  locale: Locale
}

/** Extract an 11-character YouTube video ID from a URL or return null. */
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] ?? null
    if (u.searchParams.has('v')) return u.searchParams.get('v')
    const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1] ?? null
    const shortsMatch = u.pathname.match(/\/shorts\/([^/?]+)/)
    if (shortsMatch) return shortsMatch[1] ?? null
  } catch {
    // not a URL — return null
  }
  return null
}

/** Generate and download an ICS calendar file client-side. */
function downloadIcs(concert: Concert) {
  const dateStr = concert.concertDate.slice(0, 10).replace(/-/g, '')
  const timeStr = concert.eventTime
    ? concert.eventTime.replace(':', '') + '00'
    : '000000'
  const dtStart = `${dateStr}T${timeStr}`
  const location = [concert.venueName, concert.venueCity, concert.venueCountry]
    .filter(Boolean)
    .join(', ')
  const url = typeof window !== 'undefined' ? window.location.href : ''

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `SUMMARY:${concert.eventName} – ${concert.artistName}`,
    `DTSTART:${dtStart}`,
    `LOCATION:${location}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${concert.eventName.replace(/\s+/g, '-')}.ics`
  link.click()
  URL.revokeObjectURL(link.href)
}

export function EventDetailContent({ concert, dict, locale }: EventDetailContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const d = dict.concerts
  const ed = d.eventDetail
  const portalD = dict.portal

  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const isCancelled = concert.status === 'cancelled'

  const formattedDate = new Date(concert.concertDate).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const eventTypeLabel = (() => {
    switch (concert.eventType) {
      case 'gig': return portalD.tour_type_gig
      case 'dj_set': return portalD.tour_type_dj_set
      case 'tour': return portalD.tour_type_tour
      default: return concert.eventType
    }
  })()

  const youtubeId = concert.trailerUrl ? extractYouTubeId(concert.trailerUrl) : null

  const fadeIn = {
    initial: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: prefersReducedMotion ? 0 : 0.45 },
  }

  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-16 pt-36 pb-24 max-w-3xl">

        {/* Back link */}
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent font-mono uppercase tracking-widest mb-8"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {ed.backToEvents}
        </Link>

        <motion.div {...fadeIn} className="space-y-8">

          {/* Header card */}
          <Card className="bg-card border-border p-6 md:p-8 space-y-4">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              {eventTypeLabel && (
                <Badge className="font-mono uppercase tracking-widest text-xs bg-accent/10 text-accent border-accent/30">
                  {eventTypeLabel}
                </Badge>
              )}
              {isCancelled && (
                <Badge variant="destructive" className="uppercase tracking-wide">
                  {d.cancelled}
                </Badge>
              )}
            </div>

            {/* Event name */}
            <h1 className={`text-3xl md:text-5xl font-bold tracking-tight leading-tight${isCancelled ? ' line-through opacity-60' : ''}`}>
              {concert.eventName}
            </h1>

            {/* Artist name */}
            <p className="text-xl md:text-2xl font-semibold text-muted-foreground">
              {concert.artistName}
            </p>

            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar size={16} aria-hidden="true" />
              <span className={isCancelled ? 'line-through' : ''}>
                {formattedDate}
              </span>
            </div>

            {/* Time */}
            {concert.eventTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={16} aria-hidden="true" />
                <span>{concert.eventTime}</span>
              </div>
            )}
          </Card>

          {/* Venue card */}
          {(concert.venueName || concert.venueCity) && (
            <Card className="bg-card border-border p-6 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <MapPin size={14} className="inline mr-1.5" aria-hidden="true" />
                Venue
              </h2>
              <p className="text-lg font-semibold">
                {[concert.venueName, concert.venueAddress, concert.venueCity, concert.venueCountry]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {concert.venueLat && concert.venueLng && (
                <a
                  href={`https://maps.google.com/maps?q=${concert.venueLat},${concert.venueLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  aria-label={`${concert.eventName} – ${d.navLink}`}
                >
                  <NavigationArrow size={12} aria-hidden="true" />
                  {d.navLink}
                </a>
              )}
            </Card>
          )}

          {/* Ticket CTA + Add to Calendar + Share */}
          <div className="flex flex-wrap gap-3 items-center">
              {concert.ticketUrl && (
                <Button asChild size="lg" className="uppercase tracking-wider font-bold">
                  <a
                    href={concert.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${d.ticketLink} (${d.opensInNewTab})`}
                  >
                    <Ticket size={18} className="mr-2" aria-hidden="true" />
                    {d.ticketLink}
                  </a>
                </Button>
              )}

              {/* Add to calendar */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => downloadIcs(concert)}
                className="uppercase tracking-wider font-bold border-border"
              >
                <Calendar size={18} className="mr-2" aria-hidden="true" />
                {ed.addToCalendar}
              </Button>

              {/* Share button */}
              <ShareButton
                title={`${concert.eventName} – ${concert.artistName}`}
                text={`${concert.artistName} live ${locale === 'de' ? 'am' : 'on'} ${new Date(concert.concertDate).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })}${concert.venueCity ? ` in ${concert.venueCity}` : ''}`}
                labels={{
                  share: ed.share,
                  shareSuccess: ed.shareSuccess,
                  shareLinkCopied: ed.shareLinkCopied,
                  shareError: ed.shareError,
                }}
              />
          </div>

          {/* Featured artists */}
          {concert.featuredArtists && concert.featuredArtists.length > 0 && (
            <Card className="bg-card border-border p-6 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Users size={14} aria-hidden="true" />
                {ed.featuredArtists}
              </h2>
              <div className="flex flex-wrap gap-2">
                {concert.featuredArtists.map((artist) => (
                  <Badge
                    key={artist.id}
                    variant="outline"
                    className="border-border text-foreground px-3 py-1 text-sm"
                  >
                    {artist.name}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Related news post */}
          {concert.newsPostId && (
            <Card className="bg-card border-border p-6 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Newspaper size={14} aria-hidden="true" />
                {ed.relatedNews}
              </h2>
              <Link
                href="/news"
                className="inline-flex items-center gap-2 text-accent hover:underline text-sm font-semibold"
              >
                {ed.readMore}
              </Link>
            </Card>
          )}

          {/* Trailer video */}
          {youtubeId && (
            <Card className="bg-card border-border overflow-hidden">
              <ConsentGate label="YouTube laden">
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={`${concert.eventName} – Trailer`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </ConsentGate>
            </Card>
          )}

        </motion.div>
      </div>
    </main>
  )
}

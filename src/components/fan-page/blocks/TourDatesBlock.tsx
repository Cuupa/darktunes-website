'use client'

import { Calendar, MapPin, Ticket } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { Concert } from '@/types'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface TourDatesBlockProps {
  concerts?: Concert[]
  theme: FanPageTheme
  title?: string
  limit?: number
}

export function TourDatesBlock({ concerts = [], theme, title, limit = 8 }: TourDatesBlockProps) {
  const colors = resolveThemeColors(theme)
  const now = new Date()
  const upcoming = concerts
    .filter((c) => new Date(c.concertDate) >= now)
    .sort((a, b) => a.concertDate.localeCompare(b.concertDate))
    .slice(0, limit)

  if (upcoming.length === 0) {
    return <p className="text-sm opacity-60">—</p>
  }

  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      <ul className="space-y-3">
        {upcoming.map((concert) => (
          <li
            key={concert.id}
            className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold" style={{ color: colors.text }}>
                {concert.eventName}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-sm opacity-70">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} aria-hidden />
                  {new Date(concert.concertDate).toLocaleDateString()}
                </span>
                {(concert.venueCity || concert.venueName) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} aria-hidden />
                    {[concert.venueName, concert.venueCity].filter(Boolean).join(', ')}
                  </span>
                )}
              </p>
            </div>
            {concert.ticketUrl ? (
              <Button asChild size="sm" variant="outline" className="shrink-0 border-white/20">
                <a href={concert.ticketUrl} target="_blank" rel="noopener noreferrer">
                  <Ticket size={16} className="mr-1.5" aria-hidden />
                  Tickets
                </a>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
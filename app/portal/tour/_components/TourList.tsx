'use client'

/**
 * app/portal/tour/_components/TourList.tsx — Client Component (leaf)
 *
 * Renders a list of upcoming concerts for the artist portal.
 * Receives all data as props (IoC).
 */

import Link from 'next/link'
import { MapPin, Ticket, WarningCircle } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { Dictionary } from '@/i18n/types'
import type { Concert } from '@/types'

interface TourListProps {
  dict: Dictionary['portal']
  concerts: Concert[]
}

function formatDate(dateStr: string): { day: string; month: string; year: string } {
  const d = new Date(dateStr)
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    year: d.toLocaleDateString('en-GB', { year: 'numeric' }),
  }
}

export function TourList({ dict, concerts }: TourListProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.tour_heading}</h1>

      {concerts.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{dict.tour_noData}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {concerts.map((concert) => {
            const { day, month, year } = formatDate(concert.concertDate)
            const isCancelled = concert.status === 'cancelled'
            return (
              <Card
                key={concert.id}
                className={[
                  'bg-card border-border transition-colors',
                  isCancelled ? 'opacity-60' : 'hover:border-primary/40',
                ].join(' ')}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4">
                    {/* Date badge */}
                    <div className="shrink-0 w-14 text-center">
                      <p className="text-2xl font-bold leading-none">{day}</p>
                      <p className="text-xs text-primary font-semibold tracking-widest mt-0.5">
                        {month}
                      </p>
                      <p className="text-xs text-muted-foreground">{year}</p>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-12 bg-border shrink-0" />

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{concert.eventName}</p>
                        {isCancelled && (
                          <Badge variant="destructive" className="shrink-0 text-xs">
                            <WarningCircle size={12} className="mr-1" />
                            {dict.tour_cancelled}
                          </Badge>
                        )}
                      </div>
                      {(concert.venueName || concert.venueCity) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin size={12} />
                          {[concert.venueName, concert.venueCity, concert.venueCountry]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Ticket link */}
                    {concert.ticketUrl && !isCancelled && (
                      <Button asChild size="sm" variant="outline" className="shrink-0 border-border">
                        <Link href={concert.ticketUrl} target="_blank" rel="noopener noreferrer">
                          <Ticket size={14} className="mr-1.5" />
                          {dict.tour_getTickets}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

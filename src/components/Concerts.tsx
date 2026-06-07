'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, Ticket, ArrowRight } from '@phosphor-icons/react'
import type { Concert } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface ConcertsProps extends SectionProps {
  concerts: Concert[]
  dict: Dictionary['concerts']
  locale: Locale
}

export function Concerts({ concerts, dict, locale }: ConcertsProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="concerts" className="py-24 px-4 lg:px-16 scroll-mt-36">
      <div className="container mx-auto">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="mb-12 flex items-end justify-between gap-4 flex-wrap"
        >
          <div>
            <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
            <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
          </div>
          {dict.viewAll && (
            <Button variant="ghost" className="group/btn hover:text-accent px-0 uppercase tracking-wider font-bold" asChild>
              <Link href="/events">
                {dict.viewAll}
                <ArrowRight className="ml-2 group-hover/btn:translate-x-2 transition-transform" weight="bold" />
              </Link>
            </Button>
          )}
        </motion.div>

        {concerts.length === 0 ? (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          >
            <Card className="bg-card border-border p-8 text-center">
              <p className="text-lg font-semibold mb-2">{dict.noShows}</p>
              <p className="text-muted-foreground">{dict.checkBack}</p>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {concerts.map((concert, index) => {
              const isCancelled = concert.status === 'cancelled'
              const location = [concert.venueCity, concert.venueCountry].filter(Boolean).join(', ')
              return (
                <motion.div
                  key={concert.id}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : index * 0.08 }}
                >
                  <Card className="bg-card border-border p-5 md:p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                          <Calendar size={16} />
                          <span className={isCancelled ? 'line-through' : ''}>
                            {new Date(concert.concertDate).toLocaleDateString(dateLocale, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </span>
                          {isCancelled && (
                            <Badge variant="destructive" className="uppercase tracking-wide">
                              {dict.cancelled}
                            </Badge>
                          )}
                        </div>
                        <p className="text-2xl font-bold tracking-tight">{concert.artistName}</p>
                        <p className="text-muted-foreground">{concert.eventName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin size={16} />
                          <span>{[concert.venueName, location].filter(Boolean).join(' · ')}</span>
                        </div>
                      </div>

                      {concert.ticketUrl && (
                        <Button asChild className="uppercase tracking-wider font-bold">
                          <a
                            href={concert.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${dict.ticketLink} (${dict.opensInNewTab})`}
                          >
                            <Ticket size={16} className="mr-2" />
                            {dict.ticketLink}
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

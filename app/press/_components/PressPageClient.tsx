'use client'

/**
 * app/press/_components/PressPageClient.tsx — Public EPK page (Client Component)
 *
 * Receives all data as props from the Server Component parent (IoC).
 * Sections: Bio variations, Press Photos, Tour Dates, Press Quote.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Copy, Check, Download, CalendarBlank, Quotes } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Dictionary } from '@/i18n/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { PressPhoto } from '@/lib/api/pressPhotos'
import type { Concert } from '@/types'

interface Props {
  dict: Dictionary
  photos: PressPhoto[]
  concerts: Concert[]
  profile: ArtistProfile | null
  artistName: string
}

function BioCopyButton({ text, dict }: { text: string; dict: Dictionary['press'] }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 flex-shrink-0">
      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
      {copied ? dict.bioCopied : dict.copyBio}
    </Button>
  )
}

export function PressPageClient({ dict, photos, concerts, profile, artistName }: Props) {
  const t = dict.press

  const bios = [
    { key: 'short', heading: t.bioShortHeading, text: profile?.bioShort },
    { key: 'medium', heading: t.bioMediumHeading, text: profile?.bioMedium },
    { key: 'long', heading: t.bioLongHeading, text: profile?.bioLong },
  ].filter((b): b is { key: string; heading: string; text: string } => Boolean(b.text))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-16">

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-lg">{artistName}</p>
        </header>

        {/* Bio variations */}
        {bios.length > 0 && (
          <section className="space-y-4" aria-label="Artist bios">
            {bios.map((bio) => (
              <Card key={bio.key} className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                    {bio.heading}
                  </CardTitle>
                  <BioCopyButton text={bio.text} dict={t} />
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed whitespace-pre-line">{bio.text}</p>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {/* Press photos */}
        <section className="space-y-4" aria-label="Press photos">
          <h2 className="text-2xl font-bold">{t.pressPhotosHeading}</h2>
          <p className="text-muted-foreground text-sm">{t.pressPhotosDescription}</p>
          {photos.length === 0 ? (
            <p className="text-muted-foreground">{t.noPressPhotos}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={getOptimizedImageUrl(photo.publicUrl, 800)}
                      alt={photo.altText ?? photo.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{photo.title}</span>
                    <a
                      href={photo.publicUrl}
                      download
                      className="flex-shrink-0"
                      aria-label={`${t.downloadPhoto}: ${photo.title}`}
                    >
                      <Button variant="outline" size="sm" className="gap-1">
                        <Download size={14} weight="bold" />
                        {t.downloadPhoto}
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Press quote */}
        {profile?.pressQuote && (
          <section className="space-y-4" aria-label="Press quotes">
            <h2 className="text-2xl font-bold">{t.quotesHeading}</h2>
            <blockquote className="border-l-4 border-primary pl-6 py-2 space-y-2">
              <Quotes size={24} className="text-primary" weight="fill" aria-hidden />
              <p className="text-lg italic text-foreground leading-relaxed">
                {profile.pressQuote}
              </p>
            </blockquote>
          </section>
        )}

        {/* Tour dates */}
        <section className="space-y-4" aria-label="Tour dates">
          <h2 className="text-2xl font-bold">{t.tourDatesHeading}</h2>
          {concerts.length === 0 ? (
            <p className="text-muted-foreground">{t.noTourDates}</p>
          ) : (
            <div className="space-y-3">
              {concerts.map((concert) => (
                <Card key={concert.id} className="bg-card border-border">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="flex items-start gap-4">
                      <CalendarBlank
                        size={20}
                        className="text-primary flex-shrink-0 mt-0.5"
                        weight="bold"
                        aria-hidden
                      />
                      <div>
                        <p className="font-semibold">{concert.venueName}</p>
                        <p className="text-sm text-muted-foreground">
                          {concert.venueCity}, {concert.venueCountry} —{' '}
                          {new Date(concert.concertDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {concert.ticketUrl && concert.status !== 'cancelled' && (
                      <a
                        href={concert.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <Button variant="outline" size="sm">
                          {dict.concerts.ticketLink}
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

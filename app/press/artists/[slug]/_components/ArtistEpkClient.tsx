'use client'

import { useState } from 'react'
import { sanitizeHtml as sanitizeHtmlSafe } from '@/lib/sanitizeHtml'
import DOMPurify from 'dompurify'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarBlank,
  Check,
  Copy,
  DownloadSimple,
  Globe,
  InstagramLogo,
  MusicNotes,
  Quotes,
  SpotifyLogo,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { PressPhotoLightbox } from '@/components/press/PressPhotoLightbox'
import type { Artist, Concert, PressAsset } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'

interface ArtistEpkClientProps {
  artist: Artist
  profile: ArtistProfile | null
  photos: PressAsset[]
  concerts: Concert[]
}

function pressAssetTitle(photo: PressAsset): string {
  return photo.pressCaption ?? photo.originalFilename
}

function sanitizeHtml(html: string): string {
  return sanitizeHtmlSafe(html)
}

function stripHtmlTags(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '')
  const tmp = document.createElement('div')
  tmp.innerHTML = DOMPurify.sanitize(html)
  return tmp.textContent ?? tmp.innerText ?? ''
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    await navigator.clipboard.writeText(stripHtmlTags(text))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void onCopy()} className="gap-2">
      {copied ? <Check size={14} weight="bold" aria-hidden="true" /> : <Copy size={14} weight="bold" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

const SOCIAL_LINKS = [
  { key: 'spotifyUrl', label: 'Spotify', icon: SpotifyLogo },
  { key: 'instagramUrl', label: 'Instagram', icon: InstagramLogo },
  { key: 'youtubeUrl', label: 'YouTube', icon: YoutubeLogo },
  { key: 'websiteUrl', label: 'Website', icon: Globe },
  { key: 'bandcampUrl', label: 'Bandcamp', icon: MusicNotes },
] as const

export function ArtistEpkClient({ artist, profile, photos, concerts }: ArtistEpkClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const imagePhotos = photos.filter((photo) => photo.mimeType.startsWith('image/'))

  const openLightbox = (photoId: string) => {
    const index = imagePhotos.findIndex((photo) => photo.id === photoId)
    if (index < 0) return
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const bios = [
    { label: 'Short Bio', text: profile?.bioShort },
    { label: 'Medium Bio', text: profile?.bioMedium },
    { label: 'Long Bio', text: profile?.bioLong || artist.bio },
  ].filter((item): item is { label: string; text: string } => Boolean(item.text))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground">
          <Link href="/press">← Back to press portal</Link>
        </Button>

        <section className="grid gap-6 rounded-3xl border border-border bg-card/60 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:p-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-primary">Artist Press Kit</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{artist.name}</h1>
            <p className="text-muted-foreground">{artist.genres.join(' · ')}</p>
            <div className="flex flex-wrap gap-3">
              {SOCIAL_LINKS.map(({ key, label, icon: Icon }) => {
                const href = artist[key]
                if (!href) return null
                return (
                  <Button key={key} asChild variant="outline">
                    <a href={href} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <Icon size={16} weight="bold" aria-hidden="true" />
                      {label}
                    </a>
                  </Button>
                )
              })}
              {artist.logoUrl && (
                <div className="flex flex-col items-start gap-2">
                  <div className="relative h-20 w-auto">
                    <Image
                      src={artist.logoUrl}
                      alt={`${artist.name} logo`}
                      width={200}
                      height={80}
                      className="h-20 w-auto object-contain"
                      unoptimized
                    />
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={artist.logoUrl} target="_blank" rel="noopener noreferrer" download>
                      <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                      Download Logo
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-background/50">
            <Image
              src={getOptimizedImageUrl(artist.imageUrl, 1200)}
              alt={`${artist.name} – artist photo`}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        </section>

        <section aria-labelledby="artist-bios" className="space-y-4">
          <h2 id="artist-bios" className="text-2xl font-bold tracking-tight">Bios</h2>
          <div className={`grid grid-cols-1 gap-4 ${bios.length === 2 ? 'lg:grid-cols-2' : bios.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
            {bios.map((bio) => (
              <Card key={bio.label} className="border-border bg-card/70">
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-base">{bio.label}</CardTitle>
                  <CopyButton text={bio.text} label="Copy" />
                </CardHeader>
                <CardContent>
                  <div
                    suppressHydrationWarning
                    className="text-sm leading-relaxed text-muted-foreground [&_p]:mb-2 [&_p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(bio.text) }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {profile?.pressQuote && (
          <section aria-labelledby="artist-quote" className="rounded-3xl border border-border bg-card/60 p-6">
            <div className="flex items-start gap-4">
              <Quotes size={28} weight="fill" aria-hidden="true" className="mt-1 text-primary" />
              <div className="space-y-2">
                <h2 id="artist-quote" className="text-2xl font-bold tracking-tight">Press Quote</h2>
                <blockquote className="text-lg italic leading-relaxed text-muted-foreground">{profile.pressQuote}</blockquote>
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="artist-photos" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="artist-photos" className="text-2xl font-bold tracking-tight">Press Photos</h2>
            <p className="text-sm text-muted-foreground">High-resolution downloads for editorial use.</p>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No press photos available.</p>
          ) : (
            <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-card/70">
                  {photo.mimeType.startsWith('image/') ? (
                    <button
                      type="button"
                      className="group relative block aspect-square w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openLightbox(photo.id)}
                      aria-label={`View ${pressAssetTitle(photo)}`}
                    >
                      <Image
                        src={getOptimizedImageUrl(photo.publicUrl, 1000)}
                        alt={photo.altText ?? `${artist.name} – press photo`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                    </button>
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-card p-6 text-center text-sm text-muted-foreground">
                      {pressAssetTitle(photo)}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pressAssetTitle(photo)}</p>
                      <p className="text-sm text-muted-foreground">{photo.pressCategory ?? 'photo'}</p>
                    </div>
                    <Button asChild variant="outline">
                      <a href={photo.publicUrl} target="_blank" rel="noopener noreferrer" download>
                        <DownloadSimple size={16} weight="bold" aria-hidden="true" />
                        Download
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PressPhotoLightbox
          photos={imagePhotos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          artistName={artist.name}
        />

        <section aria-labelledby="artist-tour" className="space-y-4">
          <h2 id="artist-tour" className="text-2xl font-bold tracking-tight">Tour Dates</h2>
          {concerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming dates.</p>
          ) : (
            <div className="space-y-3">
              {concerts.map((concert) => (
                <Card key={concert.id} className="border-border bg-card/70">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <CalendarBlank size={20} weight="bold" aria-hidden="true" className="mt-0.5 text-primary" />
                      <div>
                        <p className="font-semibold">{concert.eventName || concert.venueName || 'Live show'}</p>
                        <p className="text-sm text-muted-foreground">
                          {[concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-sm text-muted-foreground">{new Date(concert.concertDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {concert.ticketUrl && concert.status !== 'cancelled' && (
                      <Button asChild variant="outline">
                        <a href={concert.ticketUrl} target="_blank" rel="noopener noreferrer">Tickets</a>
                      </Button>
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

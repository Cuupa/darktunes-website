'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, EnvelopeSimple, Newspaper, Users } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getOptimizedImageUrl, getSquareThumbnail } from '@/lib/imageUtils'
import type { Dictionary } from '@/i18n/types'
import type { Artist, NewsPost, SiteSettings } from '@/types'

interface PressLandingClientProps {
  artists: Artist[]
  pressReleases: NewsPost[]
  siteSettings: Pick<SiteSettings, 'labelName' | 'labelTagline' | 'contactEmail'>
  pressDict: Dictionary['press']
  releasesDict: Dictionary['pressReleases']
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

export function PressLandingClient({
  artists,
  pressReleases,
  siteSettings,
  pressDict,
  releasesDict,
}: PressLandingClientProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="press-hero-title" className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div className="space-y-5">
              <Badge className="w-fit gap-2 bg-primary/20 text-primary hover:bg-primary/20">
                <Newspaper size={14} weight="bold" aria-hidden="true" />
                {pressDict.title}
              </Badge>
              <div className="space-y-3">
                <h1 id="press-hero-title" className="text-4xl font-bold tracking-tight sm:text-5xl">
                  {siteSettings.labelName}
                </h1>
                <p className="max-w-3xl text-lg text-muted-foreground">
                  {siteSettings.labelTagline || pressDict.metaDescription}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="#press-roster">Artist roster</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="#press-releases">{releasesDict.heading}</Link>
                </Button>
              </div>
            </div>
            <Card className="border-border bg-background/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
                  Press Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Editorial requests, interviews, review copies, and high-resolution assets for the darkTunes roster.
                </p>
                <Button asChild className="w-full sm:w-auto">
                  <a href={`mailto:${siteSettings.contactEmail}`}>{siteSettings.contactEmail}</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="press-roster" aria-labelledby="press-roster-title" className="space-y-5">
          <div className="flex items-center gap-3">
            <Users size={22} weight="bold" aria-hidden="true" className="text-primary" />
            <h2 id="press-roster-title" className="text-2xl font-bold tracking-tight">
              Artist Roster
            </h2>
          </div>
          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {artists.map((artist) => (
              <li key={artist.id}>
                <Link
                  href={`/press/artists/${artist.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={getSquareThumbnail(artist.imageUrl, 800)}
                      alt={`${artist.name} – artist photo`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">{artist.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{artist.genres.join(' · ') || artist.bio}</p>
                    </div>
                    <ArrowRight size={18} weight="bold" aria-hidden="true" className="text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="press-releases" aria-labelledby="press-releases-title" className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="press-releases-title" className="text-2xl font-bold tracking-tight">
              {releasesDict.heading}
            </h2>
            <Button asChild variant="outline">
              <Link href="/press/dashboard/press-releases">Open dashboard</Link>
            </Button>
          </div>
          {pressReleases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{releasesDict.noResults}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {pressReleases.map((post) => (
                <Card key={post.id} className="border-border bg-card/70">
                  {post.imageUrl && (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl">
                      <Image
                        src={getOptimizedImageUrl(post.imageUrl, 1200)}
                        alt={`${post.title} – press release cover`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {post.releaseCategory && <Badge variant="secondary">{post.releaseCategory}</Badge>}
                      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    </div>
                    <h3 className="text-xl font-semibold leading-tight">{post.title}</h3>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt || post.content}</p>
                    <Button asChild variant="link" className="px-0 text-primary">
                      <Link href={`/press/releases/${post.slug}`}>Read release</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="press-contact-title" className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
          <h2 id="press-contact-title" className="text-2xl font-bold tracking-tight">
            Press Contact
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            For interview requests, review opportunities, event accreditation, or bespoke press kits, reach out directly.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <a href={`mailto:${siteSettings.contactEmail}`}>Email the label</a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/press/apply">Apply for press access</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

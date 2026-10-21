'use client'

/**
 * app/portal/calendar/_components/ReleaseCalendarClient.tsx
 *
 * Unified portal calendar: label releases + live events in one month grid.
 * Artists can switch kind (all / releases / events), quick-filter to own items,
 * and search by title / venue / other artists.
 *
 * Props are injected by the Server Component parent (IoC).
 */

import 'temporal-polyfill/global'
import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import listPlugin from '@fullcalendar/react/list'
import deLocale from '@fullcalendar/react/locales/de'
import frLocale from '@fullcalendar/react/locales/fr'
import type { EventClickInfo, EventInput } from '@fullcalendar/react'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import {
  CalendarDots,
  Globe,
  MapPin,
  MusicNote,
  Ticket,
} from '@phosphor-icons/react'
import '@/components/portal/portal-calendar.css'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { buildPlatformLinkEntries } from '@/lib/platforms/buildPlatformLinkEntries'
import { ODESLI_PLATFORM_CONFIG } from '@/lib/platforms/odesliPlatformConfig'
import {
  filterCalendarConcerts,
  filterCalendarReleases,
  formatConcertArtistNames,
  formatReleaseArtistNames,
  isReleasePubliclyVisible,
  type CalendarKindFilter,
  type CalendarOwnershipFilter,
  type ReleaseTypeFilter,
} from '@/lib/portal/releaseCalendarFilters'
import type { Concert, Release } from '@/types'
import { getSquareThumbnail } from '@/lib/imageUtils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ItemStatus = 'past' | 'today' | 'upcoming'

interface ReleaseCalendarClientProps {
  releases: Release[]
  concerts: Concert[]
  currentArtistId: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getItemStatus(date: string, today: string): ItemStatus {
  if (date < today) return 'past'
  if (date === today) return 'today'
  return 'upcoming'
}

function formatDisplayDate(isoDate: string, locale: string): string {
  const tag = locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : 'en-GB'
  return new Date(isoDate + 'T12:00:00').toLocaleDateString(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status, kind }: { status: ItemStatus; kind: 'release' | 'event' }) {
  const t = useTranslations('portal')

  if (status === 'today') {
    return (
      <Badge className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5">
        {kind === 'event' ? t('calendar_status_event_today') : t('calendar_status_today')}
      </Badge>
    )
  }
  if (status === 'upcoming') {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/40 text-[10px] px-1.5 py-0.5">
        {kind === 'event' ? t('calendar_status_upcoming_event') : t('calendar_status_presave')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0.5">
      {kind === 'event' ? t('calendar_status_past_event') : t('calendar_status_released')}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Release detail dialog
// ---------------------------------------------------------------------------

function ReleaseDetailDialog({
  release,
  today,
  onClose,
}: {
  release: Release | null
  today: string
  onClose: () => void
}) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const prefersReducedMotion = useReducedMotion()

  if (!release) return null

  const status = getItemStatus(release.releaseDate, today)
  const artistNames = formatReleaseArtistNames(release)
  const showPublicPage = isReleasePubliclyVisible(release)
  const hasPresaveLink = status !== 'past' && !!release.smartlinkUrl
  const platformEntries =
    status === 'past' || status === 'today'
      ? buildPlatformLinkEntries({
          platformLinks: release.platformLinks,
          spotifyUrl: release.spotifyUrl,
          appleMusicUrl: release.appleMusicUrl,
          youtubeUrl: release.youtubeUrl,
          bandcampUrl: release.bandcampUrl,
        })
      : []
  const hasStreamingLinks = platformEntries.length > 0

  return (
    <Dialog open={!!release} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl p-0"
        aria-labelledby="release-detail-title"
      >
        <div className="overflow-y-auto overscroll-contain max-h-[80vh]" data-lenis-prevent>
          {release.coverArt ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-t-lg">
              <Image
                src={getSquareThumbnail(release.coverArt, 512)}
                alt={`${release.title} — ${t('calendar_cover_alt')}`}
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 640px) calc(100vw - 2rem), 512px"
              />
              <div className="absolute top-3 left-3">
                <StatusBadge status={status} kind="release" />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-square w-full bg-muted rounded-t-lg">
              <MusicNote size={64} weight="thin" className="text-muted-foreground/40" aria-hidden="true" />
            </div>
          )}

          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle id="release-detail-title" className="text-xl font-bold leading-tight">
                {release.title}
              </DialogTitle>
              {artistNames && (
                <DialogDescription className="text-sm text-muted-foreground">
                  {artistNames}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDots size={16} aria-hidden="true" />
              <time dateTime={release.releaseDate}>{formatDisplayDate(release.releaseDate, locale)}</time>
            </div>

            {hasPresaveLink && (
              <Link
                href={release.smartlinkUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  prefersReducedMotion ? '' : 'transition-all',
                )}
                aria-label={`${t('calendar_presave_link')} — ${release.title}`}
              >
                {t('calendar_presave_link')}
              </Link>
            )}

            {hasStreamingLinks && (
              <div className="flex flex-wrap gap-2">
                {platformEntries.map(({ key, url }) => {
                  const cfg = ODESLI_PLATFORM_CONFIG[key]
                  const Icon = cfg?.icon ?? Globe
                  const label = cfg?.label ?? key
                  const bg = cfg?.bg
                  const textColor = cfg?.textColor ?? 'text-white'
                  return (
                    <Link
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        textColor,
                        !bg && 'bg-muted text-foreground hover:bg-muted/70',
                      )}
                      style={bg ? { backgroundColor: bg } : undefined}
                      aria-label={`${label} — ${release.title}`}
                    >
                      <Icon size={16} weight="fill" aria-hidden="true" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            )}

            {showPublicPage && (
              <Link
                href={`/releases/${release.id}`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'border border-border bg-card hover:bg-muted transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {t('calendar_view_release')}
              </Link>
            )}

            {release.promoText && (
              <div className="rounded-md border border-border bg-muted/50 p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('calendar_promo_notes')}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{release.promoText}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Event detail dialog
// ---------------------------------------------------------------------------

function EventDetailDialog({
  concert,
  today,
  onClose,
}: {
  concert: Concert | null
  today: string
  onClose: () => void
}) {
  const t = useTranslations('portal')
  const locale = useLocale()

  if (!concert) return null

  const status = getItemStatus(concert.concertDate, today)
  const artistNames = formatConcertArtistNames(concert)
  const isCancelled = concert.status === 'cancelled'
  const location = [concert.venueName, concert.venueCity, concert.venueCountry]
    .filter(Boolean)
    .join(', ')

  return (
    <Dialog open={!!concert} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg p-0"
        aria-labelledby="event-detail-title"
      >
        <div className="overflow-y-auto overscroll-contain max-h-[80vh] p-6 space-y-4" data-lenis-prevent>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} kind="event" />
            {isCancelled && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                {t('calendar_status_cancelled')}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 capitalize">
              {concert.eventType || 'gig'}
            </Badge>
          </div>

          <DialogHeader>
            <DialogTitle id="event-detail-title" className="text-xl font-bold leading-tight">
              {concert.eventName}
            </DialogTitle>
            {artistNames && (
              <DialogDescription className="text-sm text-muted-foreground">
                {artistNames}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDots size={16} aria-hidden="true" />
              <time dateTime={concert.concertDate}>
                {formatDisplayDate(concert.concertDate, locale)}
                {concert.eventTime ? ` Â· ${concert.eventTime}` : null}
              </time>
            </div>
            {location && (
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{location}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {concert.ticketUrl && !isCancelled && (
              <Link
                href={concert.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <Ticket size={16} aria-hidden="true" />
                {t('calendar_tickets')}
              </Link>
            )}
            <Link
              href={`/events/${concert.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'border border-border bg-card hover:bg-muted transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {t('calendar_view_event')}
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ReleaseCalendarClient({
  releases,
  concerts,
  currentArtistId,
}: ReleaseCalendarClientProps) {
  const t = useTranslations('portal')
  const locale = useLocale()

  const today = useMemo(() => getToday(), [])
  const [kindFilter, setKindFilter] = useState<CalendarKindFilter>('all')
  const [filterMode, setFilterMode] = useState<CalendarOwnershipFilter>('all')
  const [typeFilter, setTypeFilter] = useState<ReleaseTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showReleases = kindFilter === 'all' || kindFilter === 'releases'
  const showEvents = kindFilter === 'all' || kindFilter === 'events'

  const filteredReleases = useMemo(() => {
    if (!showReleases) return []
    return filterCalendarReleases(releases, {
      filterMode,
      currentArtistId,
      typeFilter,
      searchQuery,
      sortOrder: 'asc',
    })
  }, [showReleases, releases, filterMode, currentArtistId, typeFilter, searchQuery])

  const filteredConcerts = useMemo(() => {
    if (!showEvents) return []
    return filterCalendarConcerts(concerts, {
      filterMode,
      currentArtistId,
      searchQuery,
      sortOrder: 'asc',
    })
  }, [showEvents, concerts, filterMode, currentArtistId, searchQuery])

  const fcEvents = useMemo<EventInput[]>(() => {
    const releaseEvents: EventInput[] = filteredReleases
      .filter((r) => Boolean(r.releaseDate))
      .map((release) => ({
        id: `r-${release.id}`,
        title: release.title,
        start: release.releaseDate,
        allDay: true,
        classNames: ['fc-event-release'],
        extendedProps: { kind: 'release', release },
      }))
    const concertEvents: EventInput[] = filteredConcerts
      .filter((c) => Boolean(c.concertDate))
      .map((concert) => ({
        id: `e-${concert.id}`,
        title: concert.eventName,
        start: concert.concertDate,
        allDay: true,
        classNames: ['fc-event-event'],
        extendedProps: { kind: 'event', concert },
      }))
    return [...releaseEvents, ...concertEvents]
  }, [filteredReleases, filteredConcerts])

  function onEventClick(info: EventClickInfo) {
    info.jsEvent.preventDefault()
    const kind = info.event.extendedProps.kind
    if (kind === 'release') setSelectedRelease(info.event.extendedProps.release as Release)
    if (kind === 'event') setSelectedConcert(info.event.extendedProps.concert as Concert)
  }

  const fcLocale = locale === 'de' ? deLocale : locale === 'fr' ? frLocale : undefined

  const segmentBtn = (active: boolean) =>
    cn(
      'rounded-full px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      <div className="space-y-1">
        <h1 id="calendar-heading" className="text-2xl font-bold">
          {t('calendar_heading')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('calendar_subtitle')}</p>
      </div>

      <Input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('calendar_search_placeholder')}
        aria-label={t('calendar_search_placeholder')}
        className="max-w-md"
      />

      <div className="flex flex-wrap gap-2">
        <div
          role="group"
          aria-label={t('calendar_kind_filter_label')}
          className="inline-flex rounded-full border border-border bg-card p-0.5 gap-0.5"
        >
          {([
            ['all', 'calendar_kind_all'],
            ['releases', 'calendar_kind_releases'],
            ['events', 'calendar_kind_events'],
          ] as const).map(([value, key]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKindFilter(value)}
              aria-pressed={kindFilter === value}
              className={segmentBtn(kindFilter === value)}
            >
              {t(key)}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label={t('calendar_ownership_filter_label')}
          className="inline-flex rounded-full border border-border bg-card p-0.5 gap-0.5"
        >
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            aria-pressed={filterMode === 'all'}
            className={segmentBtn(filterMode === 'all')}
          >
            {t('calendar_filter_all')}
          </button>
          {currentArtistId ? (
            <button
              type="button"
              onClick={() => setFilterMode('mine')}
              aria-pressed={filterMode === 'mine'}
              className={segmentBtn(filterMode === 'mine')}
            >
              {t('calendar_filter_mine')}
            </button>
          ) : null}
        </div>

        {showReleases ? (
          <div
            role="group"
            aria-label={t('calendar_filter_type_all')}
            className="inline-flex rounded-full border border-border bg-card p-0.5 gap-0.5"
          >
            {(['all', 'single', 'ep', 'album'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                aria-pressed={typeFilter === type}
                className={cn(segmentBtn(typeFilter === type), 'capitalize')}
              >
                {type === 'all' ? t('calendar_filter_type_all') : t(`calendar_filter_type_${type}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="portal-fc">
        <FullCalendar
          key={narrow ? 'list' : 'month'}
          plugins={[dayGridPlugin, listPlugin]}
          initialView={narrow ? 'listMonth' : 'dayGridMonth'}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth',
          }}
          locales={fcLocale ? [fcLocale] : []}
          locale={locale}
          events={fcEvents}
          eventClick={onEventClick}
          height="auto"
          firstDay={1}
          displayEventTime={false}
        />
      </div>

      <div
        className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border"
        aria-label={t('calendar_legend')}
      >
        <span className="flex items-center gap-1.5">
          <MusicNote size={12} weight="fill" className="text-primary" aria-hidden="true" />
          {t('calendar_kind_release')}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={12} weight="fill" className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          {t('calendar_kind_event')}
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDots size={12} weight="fill" className="text-secondary" aria-hidden="true" />
          {t('calendar_status_today')}
        </span>
      </div>

      <ReleaseDetailDialog
        release={selectedRelease}
        today={today}
        onClose={() => setSelectedRelease(null)}
      />
      <EventDetailDialog
        concert={selectedConcert}
        today={today}
        onClose={() => setSelectedConcert(null)}
      />
    </section>
  )
}

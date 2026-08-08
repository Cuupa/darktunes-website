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

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useReducedMotion } from 'framer-motion'
import {
  CaretLeft,
  CaretRight,
  CalendarDots,
  Globe,
  MapPin,
  MusicNote,
  Ticket,
} from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  type ReleaseSortOrder,
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

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function firstDayOfWeek(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const WEEKDAY_HEADERS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_HEADERS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function isGermanLocale(t: ReturnType<typeof useTranslations<'portal'>>): boolean {
  return t('calendar_close') === 'Schließen'
}

function getMonthName(month: number, t: ReturnType<typeof useTranslations<'portal'>>): string {
  const names = isGermanLocale(t) ? MONTH_NAMES_DE : MONTH_NAMES_EN
  return names[month - 1] ?? ''
}

function getWeekdayHeaders(t: ReturnType<typeof useTranslations<'portal'>>): string[] {
  return isGermanLocale(t) ? WEEKDAY_HEADERS_DE : WEEKDAY_HEADERS_EN
}

function formatDisplayDate(isoDate: string, t: ReturnType<typeof useTranslations<'portal'>>): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString(
    isGermanLocale(t) ? 'de-DE' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' },
  )
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
              <time dateTime={release.releaseDate}>{formatDisplayDate(release.releaseDate, t)}</time>
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
                {formatDisplayDate(concert.concertDate, t)}
                {concert.eventTime ? ` · ${concert.eventTime}` : null}
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

// ---------------------------------------------------------------------------
// Calendar day cell
// ---------------------------------------------------------------------------

interface DayCellProps {
  day: number
  dateStr: string
  releases: Release[]
  concerts: Concert[]
  today: string
  isCurrentMonth: boolean
  onSelectRelease: (r: Release) => void
  onSelectConcert: (c: Concert) => void
}

function DayCell({
  day,
  dateStr,
  releases,
  concerts,
  today,
  isCurrentMonth,
  onSelectRelease,
  onSelectConcert,
}: DayCellProps) {
  const t = useTranslations('portal')
  const isToday = dateStr === today
  const total = releases.length + concerts.length

  type Chip =
    | { key: string; kind: 'release'; title: string; artists?: string; status: ItemStatus; onClick: () => void }
    | { key: string; kind: 'event'; title: string; artists?: string; status: ItemStatus; cancelled: boolean; onClick: () => void }

  const chips: Chip[] = [
    ...releases.map((release) => ({
      key: `r-${release.id}`,
      kind: 'release' as const,
      title: release.title,
      artists: formatReleaseArtistNames(release),
      status: getItemStatus(release.releaseDate, today),
      onClick: () => onSelectRelease(release),
    })),
    ...concerts.map((concert) => ({
      key: `e-${concert.id}`,
      kind: 'event' as const,
      title: concert.eventName,
      artists: formatConcertArtistNames(concert),
      status: getItemStatus(concert.concertDate, today),
      cancelled: concert.status === 'cancelled',
      onClick: () => onSelectConcert(concert),
    })),
  ]

  const visible = chips.slice(0, 3)
  const overflow = chips.length - visible.length

  return (
    <div
      className={cn(
        'min-h-[56px] rounded-md border text-xs p-1 flex flex-col gap-0.5',
        isToday ? 'border-secondary/60 bg-secondary/10' : 'border-border bg-card',
        !isCurrentMonth && 'opacity-30',
      )}
      aria-label={`${dateStr}${total ? `, ${total} ${t('calendar_items_count')}` : ''}`}
    >
      <span
        className={cn(
          'inline-flex w-5 h-5 items-center justify-center rounded-full text-[11px] font-medium shrink-0',
          isToday ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {day}
      </span>

      <div className="flex flex-col gap-0.5 overflow-hidden">
        {visible.map((chip) => {
          const statusLabel =
            chip.kind === 'event'
              ? chip.status === 'today'
                ? t('calendar_status_event_today')
                : chip.status === 'upcoming'
                  ? t('calendar_status_upcoming_event')
                  : t('calendar_status_past_event')
              : chip.status === 'today'
                ? t('calendar_status_today')
                : chip.status === 'upcoming'
                  ? t('calendar_status_presave')
                  : t('calendar_status_released')

          return (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClick}
              className={cn(
                'w-full text-left rounded px-1 py-0.5 text-[10px] font-medium leading-tight',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                chip.kind === 'event'
                  ? chip.cancelled
                    ? 'bg-destructive/10 text-destructive line-through'
                    : chip.status === 'past'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400/80 hover:bg-emerald-500/15'
                      : chip.status === 'today'
                        ? 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                        : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/30'
                  : chip.status === 'past'
                    ? 'bg-muted/60 text-muted-foreground/70 hover:bg-muted'
                    : chip.status === 'today'
                      ? 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                      : 'bg-primary/20 text-primary hover:bg-primary/30',
              )}
              aria-label={[
                chip.kind === 'event' ? t('calendar_kind_event') : t('calendar_kind_release'),
                chip.title,
                chip.artists,
                statusLabel,
              ]
                .filter(Boolean)
                .join(' — ')}
              title={[chip.title, chip.artists].filter(Boolean).join(' — ')}
            >
              <span className="flex items-center gap-0.5 min-w-0">
                {chip.kind === 'event' ? (
                  <MapPin size={10} weight="fill" className="shrink-0" aria-hidden="true" />
                ) : (
                  <MusicNote size={10} weight="fill" className="shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{chip.title}</span>
              </span>
              {chip.artists && (
                <span className="block truncate text-[9px] font-normal opacity-80 pl-3">
                  {chip.artists}
                </span>
              )}
            </button>
          )
        })}
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground px-1">+{overflow}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReleaseCalendarClient({
  releases,
  concerts,
  currentArtistId,
}: ReleaseCalendarClientProps) {
  const t = useTranslations('portal')

  const today = useMemo(() => getToday(), [])
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1)
  const [kindFilter, setKindFilter] = useState<CalendarKindFilter>('all')
  const [filterMode, setFilterMode] = useState<CalendarOwnershipFilter>('all')
  const [typeFilter, setTypeFilter] = useState<ReleaseTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<ReleaseSortOrder>('asc')
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null)

  const showReleases = kindFilter === 'all' || kindFilter === 'releases'
  const showEvents = kindFilter === 'all' || kindFilter === 'events'

  const filteredReleases = useMemo(() => {
    if (!showReleases) return []
    return filterCalendarReleases(releases, {
      filterMode,
      currentArtistId,
      typeFilter,
      searchQuery,
      sortOrder,
    })
  }, [showReleases, releases, filterMode, currentArtistId, typeFilter, searchQuery, sortOrder])

  const filteredConcerts = useMemo(() => {
    if (!showEvents) return []
    return filterCalendarConcerts(concerts, {
      filterMode,
      currentArtistId,
      searchQuery,
      sortOrder,
    })
  }, [showEvents, concerts, filterMode, currentArtistId, searchQuery, sortOrder])

  const releasesByDate = useMemo(() => {
    const map = new Map<string, Release[]>()
    for (const r of filteredReleases) {
      if (!r.releaseDate) continue
      const list = map.get(r.releaseDate) ?? []
      list.push(r)
      map.set(r.releaseDate, list)
    }
    return map
  }, [filteredReleases])

  const concertsByDate = useMemo(() => {
    const map = new Map<string, Concert[]>()
    for (const c of filteredConcerts) {
      if (!c.concertDate) continue
      const list = map.get(c.concertDate) ?? []
      list.push(c)
      map.set(c.concertDate, list)
    }
    return map
  }, [filteredConcerts])

  const weeks = useMemo(() => {
    const totalDays = daysInMonth(viewYear, viewMonth)
    const startWeekday = firstDayOfWeek(viewYear, viewMonth)

    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
    const prevTotal = daysInMonth(prevYear, prevMonth)
    const prevDays: { day: number; dateStr: string; isCurrentMonth: false }[] = []
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevTotal - i
      prevDays.push({
        day: d,
        dateStr: toDateString(prevYear, prevMonth, d),
        isCurrentMonth: false,
      })
    }

    const currentDays: { day: number; dateStr: string; isCurrentMonth: true }[] = []
    for (let d = 1; d <= totalDays; d++) {
      currentDays.push({
        day: d,
        dateStr: toDateString(viewYear, viewMonth, d),
        isCurrentMonth: true,
      })
    }

    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1
    const allSoFar = prevDays.length + currentDays.length
    const nextCount = (7 - (allSoFar % 7)) % 7
    const nextDays: { day: number; dateStr: string; isCurrentMonth: false }[] = []
    for (let d = 1; d <= nextCount; d++) {
      nextDays.push({
        day: d,
        dateStr: toDateString(nextYear, nextMonth, d),
        isCurrentMonth: false,
      })
    }

    const all = [...prevDays, ...currentDays, ...nextDays]
    const weekChunks: typeof all[] = []
    for (let i = 0; i < all.length; i += 7) {
      weekChunks.push(all.slice(i, i + 7))
    }
    return weekChunks
  }, [viewYear, viewMonth])

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1)
        return 12
      }
      return m - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1)
        return 1
      }
      return m + 1
    })
  }, [])

  const weekdayHeaders = getWeekdayHeaders(t)
  const monthName = getMonthName(viewMonth, t)

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

      {/* Search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('calendar_search_placeholder')}
          aria-label={t('calendar_search_placeholder')}
          className="max-w-md"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="calendar-sort" className="text-sm text-muted-foreground whitespace-nowrap">
            {t('calendar_sort_label')}
          </label>
          <select
            id="calendar-sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as ReleaseSortOrder)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="asc">{t('calendar_sort_date_asc')}</option>
            <option value="desc">{t('calendar_sort_date_desc')}</option>
          </select>
        </div>
      </div>

      {/* Kind + ownership + type filters */}
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
          {currentArtistId && (
            <button
              type="button"
              onClick={() => setFilterMode('mine')}
              aria-pressed={filterMode === 'mine'}
              className={segmentBtn(filterMode === 'mine')}
            >
              {t('calendar_filter_mine')}
            </button>
          )}
        </div>

        {showReleases && (
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
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevMonth}
          aria-label={t('calendar_prev_month')}
          className="min-w-[44px] min-h-[44px]"
        >
          <CaretLeft size={18} aria-hidden="true" />
        </Button>

        <h2 className="text-lg font-semibold tabular-nums" aria-live="polite">
          {monthName} {viewYear}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          aria-label={t('calendar_next_month')}
          className="min-w-[44px] min-h-[44px]"
        >
          <CaretRight size={18} aria-hidden="true" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {weekdayHeaders.map((wd) => (
          <div
            key={wd}
            className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label={`${monthName} ${viewYear}`}
      >
        {weeks.flat().map(({ day, dateStr, isCurrentMonth }) => (
          <DayCell
            key={dateStr}
            day={day}
            dateStr={dateStr}
            releases={releasesByDate.get(dateStr) ?? []}
            concerts={concertsByDate.get(dateStr) ?? []}
            today={today}
            isCurrentMonth={isCurrentMonth}
            onSelectRelease={setSelectedRelease}
            onSelectConcert={setSelectedConcert}
          />
        ))}
      </div>

      {/* Legend */}
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

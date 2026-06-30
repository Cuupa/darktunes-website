'use client'

import { useTranslations } from 'next-intl'
/**
 * app/portal/calendar/_components/ReleaseCalendarClient.tsx
 *
 * Month-view release calendar for the Artist Portal.
 * Read-only for artists; shows all label releases with colour-coded status:
 *   - future  → primary (pre-save phase)
 *   - today   → accent ring, prominent badge
 *   - past    → dimmed / archived
 *
 * Props are injected by the Server Component parent (IoC).
 */

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import {
  CaretLeft,
  CaretRight,
  CalendarDots,
  CheckCircle,
  Clock,
  Disc,
  Globe,
  Info,
  MusicNote,
  MusicNotes,
  Sparkle,
  Stack,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  applyCalendarFilters,
  formatReleaseCellLabel,
  getReleaseArtistNames,
  releaseIsInMonth,
  type CalendarSortOption,
  type CalendarTypeFilter,
} from '@/lib/portal/calendarFilters'
import { getSquareThumbnail } from '@/lib/imageUtils'
import { buildPlatformLinkEntries } from '@/lib/platforms/buildPlatformLinkEntries'
import { ODESLI_PLATFORM_CONFIG } from '@/lib/platforms/odesliPlatformConfig'
import type { Release } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReleaseStatus = 'past' | 'today' | 'upcoming'

interface ReleaseCalendarClientProps {
  releases: Release[]
  currentArtistId: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getReleaseStatus(releaseDate: string, today: string): ReleaseStatus {
  if (releaseDate < today) return 'past'
  if (releaseDate === today) return 'today'
  return 'upcoming'
}

function getStatusChipClasses(status: ReleaseStatus): string {
  if (status === 'past') {
    return 'bg-muted/60 text-muted-foreground/70 hover:bg-muted'
  }
  if (status === 'today') {
    return 'bg-secondary/20 text-secondary hover:bg-secondary/30'
  }
  return 'bg-primary/20 text-primary hover:bg-primary/30'
}

function ReleaseTypeIcon({
  type,
  className,
}: {
  type: Release['type']
  className?: string
}) {
  if (type === 'album') {
    return <Disc size={10} weight="fill" className={className} aria-hidden="true" />
  }
  if (type === 'ep') {
    return <Stack size={10} weight="fill" className={className} aria-hidden="true" />
  }
  return <MusicNotes size={10} weight="fill" className={className} aria-hidden="true" />
}

function StatusLegendIcon({ status }: { status: ReleaseStatus }) {
  if (status === 'past') {
    return <CheckCircle size={10} weight="fill" aria-hidden="true" />
  }
  if (status === 'today') {
    return <Sparkle size={10} weight="fill" aria-hidden="true" />
  }
  return <Clock size={10} weight="fill" aria-hidden="true" />
}

/** Build a YYYY-MM-DD string from year + month (1-based) + day. */
function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Returns the number of days in a given month. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Returns the weekday index (0=Mon … 6=Sun) of the 1st of the month. */
function firstDayOfWeek(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1 // convert to Mon=0
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

function getMonthName(month: number, t: ReturnType<typeof useTranslations<'portal'>>): string {
  // Detect language from a known German key
  const isGerman = t('calendar_close') === 'Schließen'
  const names = isGerman ? MONTH_NAMES_DE : MONTH_NAMES_EN
  return names[month - 1] ?? ''
}

function getWeekdayHeaders(t: ReturnType<typeof useTranslations<'portal'>>): string[] {
  const isGerman = t('calendar_close') === 'Schließen'
  return isGerman ? WEEKDAY_HEADERS_DE : WEEKDAY_HEADERS_EN
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
}: {
  status: ReleaseStatus
}) {
  const t = useTranslations('portal')

  if (status === 'today') {
    return (
      <Badge className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5">
        {t('calendar_status_today')}
      </Badge>
    )
  }
  if (status === 'upcoming') {
    return (
      <Badge className="bg-primary/20 text-primary border border-primary/40 text-[10px] px-1.5 py-0.5">
        {t('calendar_status_presave')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0.5">
      {t('calendar_status_released')}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Release detail dialog
// ---------------------------------------------------------------------------

interface ReleaseDetailDialogProps {
  release: Release | null
  today: string
  onClose: () => void
}

function ReleaseDetailDialog({ release, today, onClose }: ReleaseDetailDialogProps) {
  const t = useTranslations('portal')

  const prefersReducedMotion = useReducedMotion()

  if (!release) return null

  const status = getReleaseStatus(release.releaseDate, today)
  const artistNames = getReleaseArtistNames(release)

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
          {/* Cover art */}
          {release.coverArt ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-t-lg">
              <Image
                src={getSquareThumbnail(release.coverArt, 600)}
                alt={`${release.title} — ${t('calendar_cover_alt')}`}
                fill
                className="object-cover"
                unoptimized
                sizes="(max-width: 640px) calc(100vw - 2rem), 512px"
              />
              {/* Status badge over cover */}
              <div className="absolute top-3 left-3">
                <StatusBadge status={status} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-square w-full bg-muted rounded-t-lg">
              <MusicNote size={64} weight="thin" className="text-muted-foreground/40" aria-hidden="true" />
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle
                id="release-detail-title"
                className="text-xl font-bold leading-tight"
              >
                {release.title}
              </DialogTitle>
              {artistNames && (
                <DialogDescription className="text-sm text-muted-foreground">
                  {artistNames}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Release date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDots size={16} aria-hidden="true" />
              <time dateTime={release.releaseDate}>
                {new Date(release.releaseDate + 'T12:00:00').toLocaleDateString(
                  t('calendar_close') === 'Schließen' ? 'de-DE' : 'en-GB',
                  { day: 'numeric', month: 'long', year: 'numeric' },
                )}
              </time>
            </div>

            {/* Presave link (future/today) */}
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

            {/* Streaming links (past/today) */}
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

            {/* Promo notes */}
            {release.promoText && (
              <div className="rounded-md border border-border bg-muted/50 p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('calendar_promo_notes')}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{release.promoText}</p>
              </div>
            )}

            <Button asChild variant="outline" className="w-full">
              <Link href={`/releases/${release.id}`}>
                {t('calendar_view_release_page')}
              </Link>
            </Button>
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
  today: string
  isCurrentMonth: boolean
  onSelectRelease: (r: Release) => void
}

function DayCell({ day, dateStr, releases, today, isCurrentMonth, onSelectRelease }: DayCellProps) {
  const t = useTranslations('portal')

  const isToday = dateStr === today
  const hasReleases = releases.length > 0

  return (
    <div
      className={cn(
        'min-h-[56px] rounded-md border text-xs p-1 flex flex-col gap-0.5',
        isToday
          ? 'border-secondary/60 bg-secondary/10'
          : 'border-border bg-card',
        !isCurrentMonth && 'opacity-30',
      )}
      aria-label={`${dateStr}${hasReleases ? `, ${releases.length} release${releases.length > 1 ? 's' : ''}` : ''}`}
    >
      {/* Day number */}
      <span
        className={cn(
          'inline-flex w-5 h-5 items-center justify-center rounded-full text-[11px] font-medium shrink-0',
          isToday
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {day}
      </span>

      {/* Release chips */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {releases.slice(0, 3).map((release) => {
          const status = getReleaseStatus(release.releaseDate, today)
          const label = formatReleaseCellLabel(release)
          const statusLabel =
            status === 'today'
              ? t('calendar_status_today')
              : status === 'past'
                ? t('calendar_status_released')
                : t('calendar_status_presave')

          return (
            <div key={release.id} className="flex items-center gap-0.5 min-w-0">
              <Link
                href={`/releases/${release.id}`}
                className={cn(
                  'flex-1 min-w-0 truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  getStatusChipClasses(status),
                )}
                aria-label={`${label} — ${statusLabel}`}
                title={label}
              >
                <span className="inline-flex items-center gap-0.5 min-w-0">
                  <ReleaseTypeIcon type={release.type} className="shrink-0 opacity-80" />
                  <span className="truncate">{label}</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => onSelectRelease(release)}
                className={cn(
                  'shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  getStatusChipClasses(status),
                )}
                aria-label={`${t('calendar_release_details')} — ${label}`}
              >
                <Info size={10} weight="bold" aria-hidden="true" />
              </button>
            </div>
          )
        })}
        {releases.length > 3 && (
          <span className="text-[10px] text-muted-foreground px-1">
            +{releases.length - 3}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReleaseCalendarClient({ releases,
  currentArtistId,
}: ReleaseCalendarClientProps) {
  const t = useTranslations('portal')

  const today = useMemo(() => getToday(), [])
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1) // 1-based
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all')
  const [typeFilter, setTypeFilter] = useState<CalendarTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<CalendarSortOption>('date-asc')
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)

  const filteredReleases = useMemo(
    () =>
      applyCalendarFilters(releases, {
        scope: filterMode,
        type: typeFilter,
        search: searchQuery,
        sort: sortOption,
        currentArtistId,
      }),
    [releases, filterMode, typeFilter, searchQuery, sortOption, currentArtistId],
  )

  const hasReleasesInViewMonth = useMemo(
    () => filteredReleases.some((release) => releaseIsInMonth(release, viewYear, viewMonth)),
    [filteredReleases, viewYear, viewMonth],
  )

  // Group releases by date string for O(1) day lookup
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

  // Build calendar grid
  const weeks = useMemo(() => {
    const totalDays = daysInMonth(viewYear, viewMonth)
    const startWeekday = firstDayOfWeek(viewYear, viewMonth) // 0=Mon

    // Prev month fill
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

    // Current month days
    const currentDays: { day: number; dateStr: string; isCurrentMonth: true }[] = []
    for (let d = 1; d <= totalDays; d++) {
      currentDays.push({
        day: d,
        dateStr: toDateString(viewYear, viewMonth, d),
        isCurrentMonth: true,
      })
    }

    // Next month fill
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
      if (m === 1) { setViewYear((y) => y - 1); return 12 }
      return m - 1
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) { setViewYear((y) => y + 1); return 1 }
      return m + 1
    })
  }, [])

  const weekdayHeaders = getWeekdayHeaders(t)
  const monthName = getMonthName(viewMonth, t)

  return (
    <section aria-labelledby="calendar-heading" className="space-y-6">
      {/* Page heading */}
      <h1 id="calendar-heading" className="text-2xl font-bold">
        {t('calendar_heading')}
      </h1>

      {/* Filter toggle */}
      <div
        role="group"
        aria-label="Filter releases"
        className="inline-flex rounded-full border border-border bg-card p-0.5 gap-0.5"
      >
        <button
          onClick={() => setFilterMode('all')}
          aria-pressed={filterMode === 'all'}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            filterMode === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('calendar_filter_all')}
        </button>
        {currentArtistId && (
          <button
            onClick={() => setFilterMode('mine')}
            aria-pressed={filterMode === 'mine'}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filterMode === 'mine'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('calendar_filter_mine')}
          </button>
        )}
      </div>

      {/* Advanced filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="calendar-type-filter">{t('calendar_filter_type')}</Label>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as CalendarTypeFilter)}>
            <SelectTrigger id="calendar-type-filter" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('calendar_filter_type_all')}</SelectItem>
              <SelectItem value="single">{t('calendar_filter_type_single')}</SelectItem>
              <SelectItem value="ep">{t('calendar_filter_type_ep')}</SelectItem>
              <SelectItem value="album">{t('calendar_filter_type_album')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="calendar-search-filter">{t('calendar_filter_search')}</Label>
          <Input
            id="calendar-search-filter"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('calendar_filter_search_placeholder')}
            className="min-h-[44px]"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="calendar-sort-filter">{t('calendar_filter_sort')}</Label>
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as CalendarSortOption)}>
            <SelectTrigger id="calendar-sort-filter" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-asc">{t('calendar_filter_sort_date_asc')}</SelectItem>
              <SelectItem value="date-desc">{t('calendar_filter_sort_date_desc')}</SelectItem>
              <SelectItem value="title-asc">{t('calendar_filter_sort_title_asc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      <div
        className="grid grid-cols-7 gap-1"
        aria-hidden="true"
      >
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
        {weeks.flat().map(({ day, dateStr, isCurrentMonth }) => {
          const dayReleases = releasesByDate.get(dateStr) ?? []
          return (
            <DayCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              releases={dayReleases}
              today={today}
              isCurrentMonth={isCurrentMonth}
              onSelectRelease={setSelectedRelease}
            />
          )
        })}
      </div>

      {!hasReleasesInViewMonth && (
        <p className="text-sm text-muted-foreground text-center py-2" role="status">
          {t('calendar_no_releases_month')}
        </p>
      )}

      {/* Legend */}
      <div
        className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border"
        aria-label="Calendar legend"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center rounded px-1 py-0.5',
              getStatusChipClasses('upcoming'),
            )}
            aria-hidden="true"
          >
            <StatusLegendIcon status="upcoming" />
          </span>
          {t('calendar_status_presave')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center rounded px-1 py-0.5',
              getStatusChipClasses('today'),
            )}
            aria-hidden="true"
          >
            <StatusLegendIcon status="today" />
          </span>
          {t('calendar_status_today')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center justify-center rounded px-1 py-0.5',
              getStatusChipClasses('past'),
            )}
            aria-hidden="true"
          >
            <StatusLegendIcon status="past" />
          </span>
          {t('calendar_status_released')}
        </span>
        <span className="flex items-center gap-1.5">
          <ReleaseTypeIcon type="single" className="text-foreground/80" />
          {t('calendar_legend_type_single')}
        </span>
        <span className="flex items-center gap-1.5">
          <ReleaseTypeIcon type="ep" className="text-foreground/80" />
          {t('calendar_legend_type_ep')}
        </span>
        <span className="flex items-center gap-1.5">
          <ReleaseTypeIcon type="album" className="text-foreground/80" />
          {t('calendar_legend_type_album')}
        </span>
      </div>

      {/* Release detail dialog */}
      <ReleaseDetailDialog
        release={selectedRelease}
        today={today}
        onClose={() => setSelectedRelease(null)}
      />
    </section>
  )
}

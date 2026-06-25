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
  MusicNote,
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
import { getSquareThumbnail } from '@/lib/imageUtils'
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
  const artistNames =
    release.artists && release.artists.length > 0
      ? release.artists.map((a) => a.name).join(', ')
      : release.artistName

  const hasPresaveLink = status !== 'past' && !!release.smartlinkUrl
  const hasStreamingLinks =
    status === 'past' || status === 'today'
      ? !!(
          release.smartUrl ||
          release.spotifyUrl ||
          release.appleMusicUrl ||
          release.youtubeUrl ||
          release.bandcampUrl
        )
      : false

  return (
    <Dialog open={!!release} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl p-0"
        aria-labelledby="release-detail-title"
      >
        <div className="overflow-y-auto max-h-[80vh]">
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
                {release.smartUrl && (
                  <Link
                    href={release.smartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                      'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    aria-label={`${t('calendar_listen_link')} — ${release.title}`}
                  >
                    {t('calendar_listen_link')}
                  </Link>
                )}
                {!release.smartUrl && release.spotifyUrl && (
                  <Link
                    href={release.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-[#1DB954] text-white hover:bg-[#1DB954]/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Spotify — ${release.title}`}
                  >
                    Spotify
                  </Link>
                )}
                {!release.smartUrl && release.appleMusicUrl && (
                  <Link
                    href={release.appleMusicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Apple Music — ${release.title}`}
                  >
                    Apple Music
                  </Link>
                )}
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

      {/* Release dots / titles */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {releases.slice(0, 3).map((release) => {
          const status = getReleaseStatus(release.releaseDate, today)
          return (
            <button
              key={release.id}
              onClick={() => onSelectRelease(release)}
              className={cn(
                'w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                status === 'past'
                  ? 'bg-muted/60 text-muted-foreground/70 hover:bg-muted'
                  : status === 'today'
                  ? 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                  : 'bg-primary/20 text-primary hover:bg-primary/30',
              )}
              aria-label={`${release.title} — ${t('calendar_status_upcoming')}`}
              title={release.title}
            >
              {release.title}
            </button>
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
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)

  // Filtered releases
  const filteredReleases = useMemo(() => {
    if (filterMode === 'mine' && currentArtistId) {
      return releases.filter((r) => {
        const isLegacy = r.artistId === currentArtistId
        const isJunction = r.artists?.some((a) => a.id === currentArtistId)
        return isLegacy || isJunction
      })
    }
    return releases
  }, [releases, filterMode, currentArtistId])

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

      {/* Legend */}
      <div
        className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border"
        aria-label="Calendar legend"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/30" aria-hidden="true" />
          {t('calendar_status_presave')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-secondary/30" aria-hidden="true" />
          {t('calendar_status_today')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted" aria-hidden="true" />
          {t('calendar_status_released')}
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

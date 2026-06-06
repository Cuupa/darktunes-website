'use client'

/**
 * app/portal/events/_components/EventManager.tsx
 *
 * Full-featured event/concert manager for the artist portal.
 *
 * Features:
 * - Create / edit / delete events
 * - Event type: Gig, DJ Set, Tour, Custom
 * - Start time field
 * - Ticket URL (auto-prefixes https://)
 * - YouTube trailer URL (optional)
 * - OpenStreetMap venue lookup via Nominatim
 * - Tag featured/supporting artists
 * - Link to a news post
 * - Share button (Web Share API with clipboard fallback)
 * - ICS calendar export
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { MapPin, Share, CalendarBlank, YoutubeLogo, MusicNotes, Newspaper } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n/types'
import type { Concert, Artist, NewsPost } from '@/types'

interface EventManagerProps {
  dict: Dictionary['portal']
  concerts: Concert[]
  artistId: string | null
  /** All artist records for the "featured artists" multi-select */
  allArtists?: Artist[]
  /** Published news posts available to link */
  newsPosts?: Pick<NewsPost, 'id' | 'title'>[]
}

type Status = 'announced' | 'confirmed' | 'cancelled'
type EventType = 'gig' | 'dj_set' | 'tour' | 'custom'

const PRESET_TYPES: EventType[] = ['gig', 'dj_set', 'tour', 'custom']

/** Sentinel for "no news post selected" — Radix UI prohibits empty-string SelectItem values */
const NO_NEWS_POST = '__none__'

const EMPTY_FORM = {
  eventName: '',
  concertDate: '',
  concertTime: '',
  eventType: 'gig' as string,
  customType: '',
  venueName: '',
  venueCity: '',
  venueCountry: '',
  venueLat: null as number | null,
  venueLng: null as number | null,
  venueOsmId: null as string | null,
  ticketUrl: '',
  trailerUrl: '',
  newsPostId: '' as string,
  featuredArtistIds: [] as string[],
}

/** Detect whether the event_type is one of the preset values */
function resolveTypeInfo(eventType: string): { preset: EventType; custom: string } {
  if (PRESET_TYPES.includes(eventType as EventType)) {
    return { preset: eventType as EventType, custom: '' }
  }
  return { preset: 'custom', custom: eventType }
}

export function EventManager({ dict, concerts, artistId, allArtists = [], newsPosts = [] }: EventManagerProps) {
  const [items, setItems] = useState(concerts)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('announced')
  const [saving, setSaving] = useState(false)
  const [osmLoading, setOsmLoading] = useState(false)
  const [osmMapUrl, setOsmMapUrl] = useState<string | null>(null)
  const eventInputRef = useRef<HTMLInputElement>(null)

  const withToken = async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(dict.tour_error)
    return session.access_token
  }

  /** Build OSM iframe src from lat/lng */
  const buildOsmUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`

  /** Look up venue via Nominatim and store coordinates */
  const lookupVenue = useCallback(async () => {
    const query = [form.venueName, form.venueCity, form.venueCountry].filter(Boolean).join(', ')
    if (!query) return
    setOsmLoading(true)
    setOsmMapUrl(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      const data = (await res.json()) as Array<{ lat: string; lon: string; place_id: number }>
      if (!data.length) {
        toast.error(dict.tour_osm_not_found)
        return
      }
      const { lat, lon, place_id } = data[0]
      setForm((prev) => ({
        ...prev,
        venueLat: parseFloat(lat),
        venueLng: parseFloat(lon),
        venueOsmId: String(place_id),
      }))
      setOsmMapUrl(buildOsmUrl(parseFloat(lat), parseFloat(lon)))
      toast.success(dict.tour_osm_found)
    } catch {
      toast.error(dict.tour_osm_not_found)
    } finally {
      setOsmLoading(false)
    }
  }, [form.venueName, form.venueCity, form.venueCountry, dict])

  /** Refresh OSM map when coordinates are already stored on load */
  useEffect(() => {
    if (form.venueLat && form.venueLng) {
      setOsmMapUrl(buildOsmUrl(form.venueLat, form.venueLng))
    } else {
      setOsmMapUrl(null)
    }
  }, [form.venueLat, form.venueLng])

  const getEffectiveType = () =>
    form.eventType === 'custom' ? form.customType || 'custom' : form.eventType

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artistId || !form.eventName || !form.concertDate) return

    setSaving(true)
    try {
      const token = await withToken()
      const res = await fetch('/api/portal/concerts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          eventName: form.eventName,
          concertDate: form.concertDate,
          concertTime: form.concertTime || null,
          eventType: getEffectiveType(),
          venueName: form.venueName || null,
          venueCity: form.venueCity || null,
          venueCountry: form.venueCountry || null,
          venueLat: form.venueLat,
          venueLng: form.venueLng,
          venueOsmId: form.venueOsmId,
          ticketUrl: form.ticketUrl || null,
          trailerUrl: form.trailerUrl || null,
          newsPostId: form.newsPostId || null,
          featuredArtistIds: form.featuredArtistIds,
          status,
        }),
      })
      if (!res.ok) throw new Error(dict.tour_error)

      const data = (await res.json()) as Concert
      if (editingId) {
        setItems((prev) => prev.map((item) => (item.id === editingId ? data : item)))
        toast.success(dict.tour_updated)
      } else {
        setItems((prev) => [data, ...prev])
        toast.success(dict.tour_created)
      }

      setEditingId(null)
      setStatus('announced')
      setForm(EMPTY_FORM)
      setOsmMapUrl(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.tour_error)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (concert: Concert) => {
    setEditingId(concert.id)
    setStatus((concert.status as Status) ?? 'announced')
    const { preset, custom } = resolveTypeInfo(concert.eventType ?? 'gig')
    setForm({
      eventName: concert.eventName,
      concertDate: concert.concertDate.slice(0, 10),
      concertTime: concert.eventTime ?? '',
      eventType: preset,
      customType: custom,
      venueName: concert.venueName ?? '',
      venueCity: concert.venueCity ?? '',
      venueCountry: concert.venueCountry ?? '',
      venueLat: concert.venueLat ?? null,
      venueLng: concert.venueLng ?? null,
      venueOsmId: concert.venueOsmId ?? null,
      ticketUrl: concert.ticketUrl ?? '',
      trailerUrl: concert.trailerUrl ?? '',
      newsPostId: concert.newsPostId ?? '',
      featuredArtistIds: concert.featuredArtists?.map((a) => a.id) ?? [],
    })
    eventInputRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingId(null)
    setStatus('announced')
    setForm(EMPTY_FORM)
    setOsmMapUrl(null)
  }

  const remove = async (id: string) => {
    if (!window.confirm(dict.tour_delete_confirm)) return
    try {
      const token = await withToken()
      const res = await fetch(`/api/portal/concerts?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error(dict.tour_error)
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(dict.tour_deleted)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.tour_error)
    }
  }

  const shareEvent = async (concert: Concert) => {
    const text = [
      concert.eventName,
      concert.concertDate.slice(0, 10),
      [concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).join(', '),
    ]
      .filter(Boolean)
      .join(' — ')
    const shareUrl = concert.ticketUrl ?? window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: concert.eventName, text, url: shareUrl })
      } catch {
        // user cancelled — ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
        toast.success(dict.tour_share_copied)
      } catch {
        toast.error(dict.tour_share_unsupported)
      }
    }
  }

  const exportIcs = async () => {
    try {
      const token = await withToken()
      const res = await fetch('/api/portal/concerts/ics', {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error(dict.tour_export_ics_error)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'events.ics'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(dict.tour_export_ics_error)
    }
  }

  const getStatusLabel = (value: string) => {
    if (value === 'announced') return dict.tour_status_announced
    if (value === 'confirmed') return dict.tour_status_confirmed
    if (value === 'cancelled') return dict.tour_status_cancelled
    return value
  }

  const getTypeLabel = (eventType: string) => {
    if (eventType === 'gig') return dict.tour_type_gig
    if (eventType === 'dj_set') return dict.tour_type_dj_set
    if (eventType === 'tour') return dict.tour_type_tour
    if (eventType === 'custom') return dict.tour_type_custom
    return eventType
  }

  const toggleFeaturedArtist = (id: string) => {
    setForm((prev) => ({
      ...prev,
      featuredArtistIds: prev.featuredArtistIds.includes(id)
        ? prev.featuredArtistIds.filter((a) => a !== id)
        : [...prev.featuredArtistIds, id],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{dict.tour_heading}</h1>
        {items.length > 0 && (
          <Button variant="outline" size="sm" className="min-h-[44px] gap-2" onClick={exportIcs}>
            <CalendarBlank size={16} aria-hidden="true" />
            {dict.tour_export_ics}
          </Button>
        )}
      </div>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <form onSubmit={submit} className="rounded-lg border border-border p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {/* Event name */}
          <div className="space-y-1">
            <Label htmlFor="ev-name">{dict.tour_event}</Label>
            <Input
              id="ev-name"
              ref={eventInputRef}
              value={form.eventName}
              onChange={(e) => setForm((v) => ({ ...v, eventName: e.target.value }))}
              required
            />
          </div>

          {/* Event type */}
          <div className="space-y-1">
            <Label htmlFor="ev-type">{dict.tour_type}</Label>
            <Select value={form.eventType} onValueChange={(v) => setForm((prev) => ({ ...prev, eventType: v }))}>
              <SelectTrigger id="ev-type" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gig">{dict.tour_type_gig}</SelectItem>
                <SelectItem value="dj_set">{dict.tour_type_dj_set}</SelectItem>
                <SelectItem value="tour">{dict.tour_type_tour}</SelectItem>
                <SelectItem value="custom">{dict.tour_type_custom}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom type label */}
          {form.eventType === 'custom' && (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ev-custom-type">{dict.tour_type_custom_label}</Label>
              <Input
                id="ev-custom-type"
                value={form.customType}
                onChange={(e) => setForm((v) => ({ ...v, customType: e.target.value }))}
                placeholder={dict.tour_type_custom}
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <Label htmlFor="ev-date">{dict.tour_date}</Label>
            <Input
              id="ev-date"
              type="date"
              value={form.concertDate}
              onChange={(e) => setForm((v) => ({ ...v, concertDate: e.target.value }))}
              required
            />
          </div>

          {/* Time */}
          <div className="space-y-1">
            <Label htmlFor="ev-time">{dict.tour_time}</Label>
            <Input
              id="ev-time"
              type="time"
              value={form.concertTime}
              onChange={(e) => setForm((v) => ({ ...v, concertTime: e.target.value }))}
            />
          </div>

          {/* Venue */}
          <Input
            placeholder={dict.tour_venue}
            value={form.venueName}
            onChange={(e) => setForm((v) => ({ ...v, venueName: e.target.value }))}
          />
          <Input
            placeholder={dict.tour_city}
            value={form.venueCity}
            onChange={(e) => setForm((v) => ({ ...v, venueCity: e.target.value }))}
          />
          <Input
            placeholder={dict.tour_country}
            value={form.venueCountry}
            onChange={(e) => setForm((v) => ({ ...v, venueCountry: e.target.value }))}
          />

          {/* OSM lookup */}
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-2 w-full"
              disabled={osmLoading || (!form.venueName && !form.venueCity && !form.venueCountry)}
              onClick={lookupVenue}
            >
              <MapPin size={16} aria-hidden="true" />
              {osmLoading ? dict.tour_osm_loading : dict.tour_osm_lookup}
            </Button>
          </div>
        </div>

        {/* OSM map preview */}
        {osmMapUrl && (
          <div className="rounded-md overflow-hidden border border-border" style={{ height: 200 }}>
            <iframe
              title="Venue map preview"
              src={osmMapUrl}
              width="100%"
              height="200"
              loading="lazy"
              className="block"
              aria-label="OpenStreetMap venue preview"
            />
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {/* Ticket URL */}
          <div className="space-y-1">
            <Label htmlFor="ev-ticket">{dict.tour_ticket_url}</Label>
            <Input
              id="ev-ticket"
              placeholder="https://tickets.example.com"
              value={form.ticketUrl}
              onChange={(e) => setForm((v) => ({ ...v, ticketUrl: e.target.value }))}
            />
          </div>

          {/* YouTube trailer */}
          <div className="space-y-1">
            <Label htmlFor="ev-trailer">
              <span className="flex items-center gap-1.5">
                <YoutubeLogo size={15} aria-hidden="true" />
                {dict.tour_trailer_url}
              </span>
            </Label>
            <Input
              id="ev-trailer"
              placeholder="https://youtube.com/watch?v=..."
              value={form.trailerUrl}
              onChange={(e) => setForm((v) => ({ ...v, trailerUrl: e.target.value }))}
            />
          </div>

          {/* Featured artists */}
          {allArtists.length > 0 && (
            <div className="space-y-1 md:col-span-2">
              <Label>
                <span className="flex items-center gap-1.5">
                  <MusicNotes size={15} aria-hidden="true" />
                  {dict.tour_featured_artists}
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {allArtists.map((artist) => {
                  const active = form.featuredArtistIds.includes(artist.id)
                  return (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => toggleFeaturedArtist(artist.id)}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:border-primary/50',
                      ].join(' ')}
                    >
                      {artist.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* News post link */}
          {newsPosts.length > 0 && (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ev-news">
                <span className="flex items-center gap-1.5">
                  <Newspaper size={15} aria-hidden="true" />
                  {dict.tour_news_link}
                </span>
              </Label>
              <Select
                value={form.newsPostId || NO_NEWS_POST}
                onValueChange={(v) => setForm((prev) => ({ ...prev, newsPostId: v === NO_NEWS_POST ? '' : v }))}>
                <SelectTrigger id="ev-news" className="min-h-[44px]">
                  <SelectValue placeholder={dict.tour_news_none} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_NEWS_POST}>{dict.tour_news_none}</SelectItem>
                  {newsPosts.map((post) => (
                    <SelectItem key={post.id} value={post.id}>{post.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Status + submit */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-44 min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announced">{dict.tour_status_announced}</SelectItem>
              <SelectItem value="confirmed">{dict.tour_status_confirmed}</SelectItem>
              <SelectItem value="cancelled">{dict.tour_status_cancelled}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="min-h-[44px]" disabled={saving}>
            {saving ? dict.tour_saving : editingId ? dict.tour_update : dict.tour_add}
          </Button>
          {editingId && (
            <Button type="button" className="min-h-[44px]" variant="outline" onClick={cancelEdit}>
              {dict.tour_cancel_edit}
            </Button>
          )}
        </div>
      </form>

      {/* ── Event list ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {items.map((concert) => (
          <div key={concert.id} className="rounded-lg border border-border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium truncate">{concert.eventName}</p>
                {concert.eventType && concert.eventType !== 'gig' && (
                  <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                    {getTypeLabel(concert.eventType)}
                  </span>
                )}
                {concert.status === 'cancelled' && (
                  <span className="rounded-full bg-destructive/10 text-destructive text-xs px-2 py-0.5">
                    {dict.tour_status_cancelled}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {concert.concertDate.slice(0, 10)}
                {concert.eventTime && ` · ${concert.eventTime.slice(0, 5)}`}
                {[concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).length > 0 && (
                  <> · {[concert.venueName, concert.venueCity, concert.venueCountry].filter(Boolean).join(', ')}</>
                )}
                {' · '}{getStatusLabel(concert.status)}
              </p>
              {concert.featuredArtists && concert.featuredArtists.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  +{' '}{concert.featuredArtists.map((a) => a.name).join(', ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                variant="ghost"
                aria-label={dict.tour_share}
                onClick={() => void shareEvent(concert)}
              >
                <Share size={16} aria-hidden="true" />
              </Button>
              <Button size="sm" className="min-h-[44px] min-w-[44px]" variant="outline" onClick={() => startEdit(concert)}>
                {dict.tour_edit}
              </Button>
              <Button size="sm" className="min-h-[44px] min-w-[44px]" variant="destructive" onClick={() => void remove(concert.id)}>
                {dict.tour_delete}
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <PortalEmptyState
            icon={MapPin}
            heading={dict.tour_noData}
            description={dict.tour_empty_description}
            action={{ label: dict.tour_add, onClick: () => eventInputRef.current?.focus() }}
          />
        )}
      </div>
    </div>
  )
}

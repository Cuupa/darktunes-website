'use client'

/**
 * src/components/admin/AdminConcertsManager.tsx
 *
 * Admin-side live shows manager.
 *
 * Provides an artist-selector dropdown so editors and admins can manage the
 * concert/event schedule for any artist without needing a portal link.
 *
 * Uses the admin concerts API (/api/admin/concerts) which is guarded by
 * verifyAdminOrEditor — distinct from the portal concerts API which requires
 * a linked artist account.
 *
 * Renders the shared EventManager component with:
 *   - concertsApiPath="/api/admin/concerts"
 *   - hideIcsExport=true  (ICS endpoint is portal-specific)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import { useDict } from '@/contexts/DictContext'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
// EventManager lives under app/ (not src/) — relative import is required
import { EventManager } from '../../../app/portal/events/_components/EventManager'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import type { Artist, Concert, NewsPost } from '@/types'

const NO_ARTIST = '__none__'

export function AdminConcertsManager() {
  const dict = useDict()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [artists, setArtists] = useState<Pick<Artist, 'id' | 'name'>[]>([])
  const [artistsLoading, setArtistsLoading] = useState(true)

  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [newsPosts, setNewsPosts] = useState<Pick<NewsPost, 'id' | 'title'>[]>([])
  const [concertsLoading, setConcertsLoading] = useState(false)

  // Load all artists on mount
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('artists')
        .select('id, name')
        .order('name', { ascending: true })
      setArtists((data ?? []) as Pick<Artist, 'id' | 'name'>[])
      setArtistsLoading(false)
    }
    void load()
  }, [supabase])

  // Load concerts and news posts when artist changes
  const loadConcerts = useCallback(
    async (artistId: string) => {
      setConcertsLoading(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const [{ data: concertRows }, { data: newsRows }] = await Promise.all([
          supabase
            .from('concerts')
            .select('*')
            .eq('artist_id', artistId)
            .gte('concert_date', today)
            .order('concert_date', { ascending: true }),
          supabase
            .from('news_posts')
            .select('id, title')
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(50),
        ])

        const mapped: Concert[] = (concertRows ?? []).map((row) => ({
          id: row.id,
          artistId: row.artist_id,
          artistName: '',
          eventName: row.event_name,
          venueName: row.venue_name,
          venueAddress: row.venue_address ?? null,
          venueCity: row.venue_city,
          venueCountry: row.venue_country,
          concertDate: row.concert_date,
          ticketUrl: row.ticket_url,
          songkickId: row.songkick_id,
          bandsintownId: row.bandsintown_id,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          eventTime: row.event_time ?? null,
          eventType: row.event_type ?? 'gig',
          trailerUrl: row.trailer_url ?? null,
          venueLat: row.venue_lat ?? null,
          venueLng: row.venue_lng ?? null,
          venueOsmId: row.venue_osm_id ?? null,
          newsPostId: row.news_post_id ?? null,
        }))

        setConcerts(mapped)
        setNewsPosts(
          (newsRows ?? []).map((r) => ({ id: r.id as string, title: r.title as string })),
        )
      } finally {
        setConcertsLoading(false)
      }
    },
    [supabase],
  )

  const handleArtistChange = (value: string) => {
    if (value === NO_ARTIST) {
      setSelectedArtistId(null)
      setConcerts([])
      return
    }
    setSelectedArtistId(value)
    void loadConcerts(value)
  }

  if (artistsLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading artists">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <PortalEmptyState
        icon={CalendarBlank}
        heading="No artists found"
        description="Add artists before managing their live shows."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Artist selector */}
      <div className="space-y-2 max-w-sm">
        <label
          htmlFor="admin-concerts-artist"
          className="text-sm font-medium"
        >
          Select artist
        </label>
        <Select value={selectedArtistId ?? NO_ARTIST} onValueChange={handleArtistChange}>
          <SelectTrigger id="admin-concerts-artist" className="min-h-[44px]">
            <SelectValue placeholder="Choose an artist…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ARTIST}>— Choose an artist —</SelectItem>
            {artists.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select an artist to view and manage their upcoming live shows. Changes are applied immediately.
        </p>
      </div>

      {/* EventManager (rendered once an artist is selected) */}
      {selectedArtistId && (
        concertsLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading events">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <EventManager
            dict={dict.portal}
            concerts={concerts}
            artistId={selectedArtistId}
            allArtists={artists as Artist[]}
            newsPosts={newsPosts}
            concertsApiPath="/api/admin/concerts"
            hideIcsExport
          />
        )
      )}
    </div>
  )
}

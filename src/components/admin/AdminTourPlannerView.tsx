'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapTrifold } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Artist, Tour, TourStop } from '@/types'

const NO_ARTIST = '__none__'

function mapStop(row: Record<string, unknown>): TourStop {
  return {
    id: row.id as string,
    tourId: row.tour_id as string,
    artistId: row.artist_id as string,
    concertId: (row.concert_id as string | null) ?? null,
    stopDate: row.stop_date as string,
    isTravelDay: Boolean(row.is_travel_day),
    sortOrder: Number(row.sort_order),
    venueName: (row.venue_name as string | null) ?? null,
    venueAddress: (row.venue_address as string | null) ?? null,
    venueCity: (row.venue_city as string | null) ?? null,
    venueCountry: (row.venue_country as string | null) ?? null,
    venueLat: row.venue_lat != null ? Number(row.venue_lat) : null,
    venueLng: row.venue_lng != null ? Number(row.venue_lng) : null,
    venueValidated: Boolean(row.venue_validated),
    hotelName: (row.hotel_name as string | null) ?? null,
    hotelAddress: (row.hotel_address as string | null) ?? null,
    hotelCity: (row.hotel_city as string | null) ?? null,
    hotelCountry: (row.hotel_country as string | null) ?? null,
    hotelLat: row.hotel_lat != null ? Number(row.hotel_lat) : null,
    hotelLng: row.hotel_lng != null ? Number(row.hotel_lng) : null,
    hotelValidated: Boolean(row.hotel_validated),
    arrivalTime: (row.arrival_time as string | null) ?? null,
    showStatus: row.show_status as TourStop['showStatus'],
    daySchedule: (row.day_schedule as TourStop['daySchedule']) ?? null,
    deal: (row.deal as TourStop['deal']) ?? null,
    settlement: (row.settlement as TourStop['settlement']) ?? null,
    perDiems: (row.per_diems as TourStop['perDiems']) ?? [],
    rooming: (row.rooming as TourStop['rooming']) ?? [],
    travelManifest: (row.travel_manifest as TourStop['travelManifest']) ?? [],
    venueDetails: (row.venue_details as TourStop['venueDetails']) ?? null,
    venueContactInfo: (row.venue_contact_info as TourStop['venueContactInfo']) ?? null,
    guestList: (row.guest_list as TourStop['guestList']) ?? [],
    guestListLimit: row.guest_list_limit != null ? Number(row.guest_list_limit) : null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapTour(row: Record<string, unknown>): Tour {
  return {
    id: row.id as string,
    artistId: row.artist_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    archived: Boolean(row.archived),
    sortOrder: Number(row.sort_order),
    settings: row.settings as Tour['settings'],
    routeCache: (row.route_cache as Tour['routeCache']) ?? null,
    budget: (row.budget as Tour['budget']) ?? null,
    techDocuments: (row.tech_documents as Tour['techDocuments']) ?? [],
    currency: row.currency as string,
    totalBudget: row.total_budget != null ? Number(row.total_budget) : null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function AdminTourPlannerView() {
  const t = useTranslations('admin')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [artists, setArtists] = useState<Pick<Artist, 'id' | 'name'>[]>([])
  const [artistsLoading, setArtistsLoading] = useState(true)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [tours, setTours] = useState<Tour[]>([])
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null)
  const [stops, setStops] = useState<TourStop[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('artists').select('id, name').order('name', { ascending: true })
      setArtists((data ?? []) as Pick<Artist, 'id' | 'name'>[])
      setArtistsLoading(false)
    }
    void load()
  }, [supabase])

  const loadTours = useCallback(async (artistId: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('tours')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false })
      const mapped = (data ?? []).map((row) => mapTour(row as Record<string, unknown>))
      setTours(mapped)
      setSelectedTourId(mapped[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadStops = useCallback(async (tourId: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('tour_stops')
        .select('*')
        .eq('tour_id', tourId)
        .order('sort_order', { ascending: true })
      setStops((data ?? []).map((row) => mapStop(row as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!selectedArtistId) {
      setTours([])
      setSelectedTourId(null)
      setStops([])
      return
    }
    void loadTours(selectedArtistId)
  }, [selectedArtistId, loadTours])

  useEffect(() => {
    if (!selectedTourId) {
      setStops([])
      return
    }
    void loadStops(selectedTourId)
  }, [selectedTourId, loadStops])

  const activeTour = tours.find((tour) => tour.id === selectedTourId) ?? null

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('tour_planner_readonly_desc')}</p>

      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="admin-tour-artist">{t('tour_planner_artist')}</label>
          {artistsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={selectedArtistId ?? NO_ARTIST}
              onValueChange={(v) => setSelectedArtistId(v === NO_ARTIST ? null : v)}
            >
              <SelectTrigger id="admin-tour-artist" aria-label={t('tour_planner_artist')}>
                <SelectValue placeholder={t('tour_planner_select_artist')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ARTIST}>{t('tour_planner_select_artist')}</SelectItem>
                {artists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedArtistId && (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-tour-select">{t('tour_planner_tour')}</label>
            {loading && tours.length === 0 ? (
              <Skeleton className="h-10 w-full" />
            ) : tours.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('tour_planner_no_tours')}</p>
            ) : (
              <Select value={selectedTourId ?? undefined} onValueChange={setSelectedTourId}>
                <SelectTrigger id="admin-tour-select" aria-label={t('tour_planner_tour')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tours.map((tour) => (
                    <SelectItem key={tour.id} value={tour.id}>
                      {tour.name}{tour.archived ? ` (${t('tour_planner_archived')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {!selectedArtistId && (
        <PortalEmptyState
          icon={MapTrifold}
          heading={t('tour_planner_heading')}
          description={t('tour_planner_select_artist_hint')}
        />
      )}

      {activeTour && (
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
          <p><span className="font-medium">{t('tour_planner_tour')}:</span> {activeTour.name}</p>
          {activeTour.startDate && (
            <p><span className="font-medium">{t('tour_planner_dates')}:</span> {activeTour.startDate}{activeTour.endDate ? ` – ${activeTour.endDate}` : ''}</p>
          )}
          {activeTour.routeCache && !activeTour.routeCache.error && (
            <p>
              <span className="font-medium">{t('tour_planner_route')}:</span>{' '}
              {Math.round(activeTour.routeCache.totalDistance / 1000)} km · {Math.round(activeTour.routeCache.totalDuration / 60)} min
            </p>
          )}
        </div>
      )}

      {selectedTourId && stops.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t('tour_planner_stop_date')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('tour_planner_venue')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('tour_planner_status')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('tour_planner_linked_event')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stops.map((stop) => (
                <tr key={stop.id}>
                  <td className="px-4 py-2">{stop.stopDate}{stop.isTravelDay ? ` (${t('tour_planner_travel_day')})` : ''}</td>
                  <td className="px-4 py-2">{stop.venueName ?? '—'}{stop.venueCity ? `, ${stop.venueCity}` : ''}</td>
                  <td className="px-4 py-2">{stop.showStatus}</td>
                  <td className="px-4 py-2">{stop.concertId ? t('tour_planner_yes') : t('tour_planner_no')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTourId && !loading && stops.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('tour_planner_no_stops')}</p>
      )}
    </div>
  )
}
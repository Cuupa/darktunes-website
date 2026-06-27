'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MapTrifold, Plus, ArrowSquareOut } from '@phosphor-icons/react'
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
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Concert, Tour, TourStop } from '@/types'

interface TourPlannerShellProps {
  artistId: string
  artistName: string
  initialTours: Tour[]
  concerts: Concert[]
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export function TourPlannerShell({ artistId, artistName, initialTours, concerts }: TourPlannerShellProps) {
  const t = useTranslations('portal')
  const queryClient = useQueryClient()
  const [activeTourId, setActiveTourId] = useState<string | null>(initialTours[0]?.id ?? null)
  const [newTourName, setNewTourName] = useState('')
  const [newStopDate, setNewStopDate] = useState('')
  const [newStopVenue, setNewStopVenue] = useState('')

  const toursQueryKey = useMemo(() => ['tour-planner', 'tours', artistId] as const, [artistId])
  const stopsQueryKey = useMemo(
    () => ['tour-planner', 'stops', artistId, activeTourId] as const,
    [artistId, activeTourId],
  )

  const { data: tours = initialTours } = useQuery({
    queryKey: toursQueryKey,
    queryFn: async () => {
      const token = await getAccessToken()
      const res = await fetch(`/api/portal/tour-planner/tours?artistId=${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load tours')
      const json = (await res.json()) as { tours: Tour[] }
      return json.tours
    },
    initialData: initialTours,
  })

  const { data: stops = [] } = useQuery({
    queryKey: stopsQueryKey,
    enabled: Boolean(activeTourId),
    queryFn: async () => {
      const token = await getAccessToken()
      const res = await fetch(
        `/api/portal/tour-planner/stops?artistId=${artistId}&tourId=${activeTourId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error('Failed to load stops')
      const json = (await res.json()) as { stops: TourStop[] }
      return json.stops
    },
  })

  const createTourMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = await getAccessToken()
      const res = await fetch(`/api/portal/tour-planner/tours?artistId=${artistId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed to create tour')
      const json = (await res.json()) as { tour: Tour }
      return json.tour
    },
    onSuccess: (tour) => {
      queryClient.invalidateQueries({ queryKey: toursQueryKey })
      setActiveTourId(tour.id)
      setNewTourName('')
      toast.success(t('tour_planner_tour_created'))
    },
    onError: () => toast.error(t('tour_planner_error')),
  })

  const createStopMutation = useMutation({
    mutationFn: async () => {
      if (!activeTourId) throw new Error('No active tour')
      const token = await getAccessToken()
      const res = await fetch(`/api/portal/tour-planner/stops?artistId=${artistId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tourId: activeTourId,
          stopDate: newStopDate,
          venueName: newStopVenue || null,
          sortOrder: stops.length,
        }),
      })
      if (!res.ok) throw new Error('Failed to create stop')
      const json = (await res.json()) as { stop: TourStop }
      return json.stop
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stopsQueryKey })
      setNewStopDate('')
      setNewStopVenue('')
      toast.success(t('tour_planner_stop_created'))
    },
    onError: () => toast.error(t('tour_planner_error')),
  })

  const importConcertMutation = useMutation({
    mutationFn: async (concertId: string) => {
      if (!activeTourId) throw new Error('No active tour')
      const token = await getAccessToken()
      const res = await fetch(`/api/portal/tour-planner/stops/import-concert?artistId=${artistId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tourId: activeTourId, concertId }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? 'Import failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stopsQueryKey })
      toast.success(t('tour_planner_import_success'))
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const activeTour = tours.find((tour) => tour.id === activeTourId) ?? null

  const handleCreateTour = useCallback(() => {
    const name = newTourName.trim()
    if (!name) return
    createTourMutation.mutate(name)
  }, [createTourMutation, newTourName])

  const importableConcerts = concerts.filter(
    (concert) => !stops.some((stop) => stop.concertId === concert.id),
  )

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <MapTrifold size={28} className="text-primary" aria-hidden />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('tour_planner_heading')}</h1>
            <p className="text-muted-foreground text-sm">{t('tour_planner_subheading', { artist: artistName })}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{t('tour_planner_intro')}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{t('tour_planner_tours_heading')}</h2>
          <div className="flex gap-2">
            <Input
              value={newTourName}
              onChange={(e) => setNewTourName(e.target.value)}
              placeholder={t('tour_planner_new_tour_placeholder')}
              aria-label={t('tour_planner_new_tour_placeholder')}
            />
            <Button onClick={handleCreateTour} disabled={createTourMutation.isPending}>
              <Plus size={16} aria-hidden />
              {t('tour_planner_create_tour')}
            </Button>
          </div>

          {tours.length === 0 ? (
            <PortalEmptyState
              icon={MapTrifold}
              heading={t('tour_planner_no_tours')}
              description={t('tour_planner_no_tours_desc')}
            />
          ) : (
            <Select value={activeTourId ?? undefined} onValueChange={setActiveTourId}>
              <SelectTrigger aria-label={t('tour_planner_select_tour')}>
                <SelectValue placeholder={t('tour_planner_select_tour')} />
              </SelectTrigger>
              <SelectContent>
                {tours.map((tour) => (
                  <SelectItem key={tour.id} value={tour.id}>
                    {tour.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{t('tour_planner_stops_heading')}</h2>
          {!activeTour ? (
            <p className="text-sm text-muted-foreground">{t('tour_planner_select_tour_first')}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="new-stop-date">{t('tour_planner_stop_date')}</Label>
                  <Input
                    id="new-stop-date"
                    type="date"
                    value={newStopDate}
                    onChange={(e) => setNewStopDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-stop-venue">{t('tour_planner_stop_venue')}</Label>
                  <Input
                    id="new-stop-venue"
                    value={newStopVenue}
                    onChange={(e) => setNewStopVenue(e.target.value)}
                    placeholder={t('tour_planner_stop_venue_placeholder')}
                  />
                </div>
              </div>
              <Button
                onClick={() => createStopMutation.mutate()}
                disabled={!newStopDate || createStopMutation.isPending}
              >
                <Plus size={16} aria-hidden />
                {t('tour_planner_add_stop')}
              </Button>

              {stops.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('tour_planner_no_stops')}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {stops.map((stop) => (
                    <li key={stop.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <div>
                        <p className="font-medium">{stop.venueName ?? t('tour_planner_unnamed_stop')}</p>
                        <p className="text-muted-foreground">
                          {stop.stopDate}
                          {stop.venueCity ? ` · ${stop.venueCity}` : ''}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{stop.showStatus}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {activeTour && importableConcerts.length > 0 && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{t('tour_planner_import_heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('tour_planner_import_desc')}</p>
          <ul className="space-y-2">
            {importableConcerts.map((concert) => (
              <li key={concert.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="font-medium">{concert.eventName}</p>
                  <p className="text-sm text-muted-foreground">
                    {concert.concertDate}
                    {concert.venueCity ? ` · ${concert.venueCity}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importConcertMutation.mutate(concert.id)}
                  disabled={importConcertMutation.isPending}
                >
                  <ArrowSquareOut size={14} aria-hidden />
                  {t('tour_planner_import_button')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
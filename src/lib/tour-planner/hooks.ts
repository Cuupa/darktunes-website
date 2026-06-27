'use client'

import { useQuery } from '@tanstack/react-query'
import { parseTourPlannerJson, tourPlannerFetch } from '@/lib/tour-planner/clientApi'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
import type { Tour, TourCrewMember, TourContact, TourMerchItem, TourStop, TourTask } from '@/types'

export function useTourPlannerTours(artistId: string, initialTours: Tour[]) {
  return useQuery({
    queryKey: tourPlannerKeys.tours(artistId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/tours')
      const json = await parseTourPlannerJson<{ tours: Tour[] }>(res)
      return json.tours
    },
    initialData: initialTours,
  })
}

export function useTourPlannerStops(artistId: string, tourId: string | null) {
  return useQuery({
    queryKey: tourPlannerKeys.stops(artistId, tourId),
    enabled: Boolean(tourId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, `/stops?tourId=${tourId}`)
      const json = await parseTourPlannerJson<{ stops: TourStop[] }>(res)
      return json.stops
    },
  })
}

export function useTourPlannerTasks(artistId: string, tourId: string | null) {
  return useQuery({
    queryKey: tourPlannerKeys.tasks(artistId, tourId),
    enabled: Boolean(tourId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, `/tasks?tourId=${tourId}`)
      const json = await parseTourPlannerJson<{ tasks: TourTask[] }>(res)
      return json.tasks
    },
  })
}

export function useTourPlannerContacts(artistId: string) {
  return useQuery({
    queryKey: tourPlannerKeys.contacts(artistId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/contacts')
      const json = await parseTourPlannerJson<{ contacts: TourContact[] }>(res)
      return json.contacts
    },
  })
}

export function useTourPlannerCrew(artistId: string, tourId: string | null) {
  return useQuery({
    queryKey: tourPlannerKeys.crew(artistId, tourId),
    enabled: Boolean(tourId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, `/crew?tourId=${tourId}`)
      const json = await parseTourPlannerJson<{ crew: TourCrewMember[] }>(res)
      return json.crew
    },
  })
}

export function useTourPlannerMerch(artistId: string) {
  return useQuery({
    queryKey: tourPlannerKeys.merch(artistId),
    queryFn: async () => {
      const res = await tourPlannerFetch(artistId, '/merch')
      const json = await parseTourPlannerJson<{ items: TourMerchItem[] }>(res)
      return json.items
    },
  })
}
import type { QueryClient } from '@tanstack/react-query'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
import type { Tour, TourStop, TourTask } from '@/types'

export function patchStopInCache(
  queryClient: QueryClient,
  artistId: string,
  tourId: string | null,
  stopId: string,
  patch: Record<string, unknown>,
): void {
  if (!tourId) return
  queryClient.setQueryData<TourStop[]>(tourPlannerKeys.stops(artistId, tourId), (old) =>
    old?.map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop)),
  )
}

export function setStopsOrderInCache(
  queryClient: QueryClient,
  artistId: string,
  tourId: string | null,
  orderedStops: TourStop[],
): void {
  if (!tourId) return
  queryClient.setQueryData<TourStop[]>(tourPlannerKeys.stops(artistId, tourId), orderedStops)
}

export function appendStopToCache(
  queryClient: QueryClient,
  artistId: string,
  tourId: string,
  stop: TourStop,
): void {
  queryClient.setQueryData<TourStop[]>(tourPlannerKeys.stops(artistId, tourId), (old) => [
    ...(old ?? []),
    stop,
  ])
}

export function removeStopFromCache(
  queryClient: QueryClient,
  artistId: string,
  tourId: string | null,
  stopId: string,
): void {
  if (!tourId) return
  queryClient.setQueryData<TourStop[]>(tourPlannerKeys.stops(artistId, tourId), (old) =>
    old?.filter((stop) => stop.id !== stopId),
  )
}

export function appendTourToCache(
  queryClient: QueryClient,
  artistId: string,
  tour: Tour,
): void {
  queryClient.setQueryData<Tour[]>(tourPlannerKeys.tours(artistId), (old) => [...(old ?? []), tour])
}

export function appendTaskToCache(
  queryClient: QueryClient,
  artistId: string,
  tourId: string,
  task: TourTask,
): void {
  queryClient.setQueryData<TourTask[]>(tourPlannerKeys.tasks(artistId, tourId), (old) => [
    ...(old ?? []),
    task,
  ])
}

export function invalidateTourPlannerWhenOnline(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  void queryClient.invalidateQueries({ queryKey })
}
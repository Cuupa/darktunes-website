import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import * as releasesApi from '@/lib/api/releases'
import { searchItunesArtist } from '@/lib/itunesApi'
import { artistsData } from '@/lib/artistsData'
import type { Release } from '@/types'
import type { Database } from '@/types/database'
import type { iTunesRelease } from '@/lib/itunesApi'

type ReleaseInsert = Database['public']['Tables']['releases']['Insert']
type ReleaseUpdate = Database['public']['Tables']['releases']['Update']

function itunesReleaseToInsert(ir: iTunesRelease): ReleaseInsert {
  const trackCount = ir.trackCount
  const type: 'album' | 'ep' | 'single' =
    trackCount === 1 ? 'single' : trackCount <= 6 ? 'ep' : 'album'

  return {
    title: ir.collectionName,
    artist_name: ir.artistName,
    release_date: ir.releaseDate.split('T')[0],
    cover_art: ir.artworkUrl600 ?? ir.artworkUrl100.replace('100x100', '600x600'),
    type,
    apple_music_url: ir.collectionViewUrl,
    itunes_id: String(ir.collectionId),
    featured: false,
  }
}

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await releasesApi.getReleases(supabase)
      setReleases(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setReleases([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createRelease = async (data: ReleaseInsert): Promise<void> => {
    await releasesApi.createRelease(supabase, data)
    await load()
  }

  const updateRelease = async (id: string, data: ReleaseUpdate): Promise<void> => {
    await releasesApi.updateRelease(supabase, id, data)
    await load()
  }

  const deleteRelease = async (id: string): Promise<void> => {
    await releasesApi.deleteRelease(supabase, id)
    await load()
  }

  const syncFromItunes = async (): Promise<void> => {
    if (!isSupabaseConfigured) return
    setIsSyncing(true)
    setSyncProgress(0)
    const artistNames = artistsData.map((a) => a.name)
    for (let i = 0; i < artistNames.length; i++) {
      try {
        const itunesReleases = await searchItunesArtist(artistNames[i])
        for (const ir of itunesReleases) {
          try {
            await releasesApi.upsertReleaseByItunesId(supabase, itunesReleaseToInsert(ir))
          } catch {
            // Skip individual upsert failures to not block the sync
          }
        }
      } catch {
        // Skip individual artist fetch failures
      }
      setSyncProgress(Math.round(((i + 1) / artistNames.length) * 100))
      await new Promise<void>((resolve) => setTimeout(resolve, 200))
    }
    setIsSyncing(false)
    setSyncProgress(0)
    await load()
  }

  useEffect(() => {
    void load()
  }, [load])

  return {
    releases,
    isLoading,
    isSyncing,
    syncProgress,
    error,
    createRelease,
    updateRelease,
    deleteRelease,
    syncFromItunes,
    reload: load,
  }
}

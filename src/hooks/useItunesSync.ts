import { useState, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { searchItunesArtist, convertItunesReleaseToRelease } from '@/lib/itunesApi'
import { artistsData } from '@/lib/artistsData'
import type { Release } from '@/types'

export function useItunesSync() {
  const [releases, setReleases] = useLocalStorage<Release[]>('itunes-releases', [])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useLocalStorage<string | null>('itunes-last-sync', null)
  const [syncProgress, setSyncProgress] = useState(0)

  const syncReleases = async () => {
    setIsSyncing(true)
    setSyncProgress(0)
    
    const allReleases: Release[] = []
    const artistNames = artistsData.map(a => a.name)
    
    for (let i = 0; i < artistNames.length; i++) {
      const artistName = artistNames[i]
      try {
        const itunesReleases = await searchItunesArtist(artistName)
        const convertedReleases = itunesReleases.map(convertItunesReleaseToRelease)
        allReleases.push(...convertedReleases)
      } catch (error) {
        console.error(`Failed to sync ${artistName}:`, error)
      }
      
      setSyncProgress(Math.round(((i + 1) / artistNames.length) * 100))
      
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    allReleases.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    
    setReleases(allReleases)
    setLastSync(new Date().toISOString())
    setIsSyncing(false)
    setSyncProgress(0)
  }

  const shouldAutoSync = () => {
    if (!lastSync) return true
    const lastSyncDate = new Date(lastSync)
    const now = new Date()
    const hoursSinceSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60)
    return hoursSinceSync > 24
  }

  useEffect(() => {
    if (!releases || releases.length === 0 || shouldAutoSync()) {
      setIsLoading(true)
      syncReleases().finally(() => setIsLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    releases,
    isLoading,
    isSyncing,
    syncProgress,
    lastSync,
    syncReleases
  }
}

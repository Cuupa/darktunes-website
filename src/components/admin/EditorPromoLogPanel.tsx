'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useArtists } from '@/hooks/useArtists'
import { PromoLogManager } from '@/components/admin/PromoLogManager'

export function EditorPromoLogPanel() {
  const { artists, isLoading } = useArtists()
  const [activeArtistId, setActiveArtistId] = useState<string | null>(null)

  useEffect(() => {
    if (artists.length === 0) {
      setActiveArtistId(null)
      return
    }
    if (!activeArtistId || !artists.some((artist) => artist.id === activeArtistId)) {
      setActiveArtistId(artists[0]?.id ?? null)
    }
  }, [artists, activeArtistId])

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading promo log">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No artists available yet. Add an artist before creating marketing activities.
      </p>
    )
  }

  const activeArtist = artists.find((artist) => artist.id === activeArtistId) ?? artists[0]

  return (
    <div className="space-y-6">
      <div className="max-w-sm space-y-2">
        <Label htmlFor="editor-promo-log-artist-select">Artist</Label>
        <Select value={activeArtist.id} onValueChange={setActiveArtistId}>
          <SelectTrigger
            id="editor-promo-log-artist-select"
            aria-label="Select artist for promo log"
            className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <SelectValue placeholder="Select artist" />
          </SelectTrigger>
          <SelectContent>
            {artists.map((artist) => (
              <SelectItem key={artist.id} value={artist.id}>
                {artist.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PromoLogManager artistId={activeArtist.id} artistName={activeArtist.name} />
    </div>
  )
}
'use client'

/**
 * PromoLogArtistSelector — small client component that updates the
 * `?artistId=` search param when the admin picks a different artist.
 */

import { usePathname, useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Artist } from '@/types'

interface PromoLogArtistSelectorProps {
  artists: Artist[]
  activeArtistId: string | null
}

export function PromoLogArtistSelector({ artists, activeArtistId }: PromoLogArtistSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()

  if (artists.length === 0) return null

  function handleArtistChange(artistId: string) {
    const params = new URLSearchParams()
    params.set('artistId', artistId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>Artist</CardTitle>
        <CardDescription>Select which artist&apos;s promo timeline you want to manage.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="promo-log-artist-select">Artist</Label>
          <Select value={activeArtistId ?? undefined} onValueChange={handleArtistChange}>
            <SelectTrigger
              id="promo-log-artist-select"
              aria-label="Select artist"
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
      </CardContent>
    </Card>
  )
}

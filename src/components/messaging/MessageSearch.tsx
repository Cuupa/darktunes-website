'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MessageSearchProps {
  artists: Array<{ id: string; name: string }>
  onSearch: (query: string, artistId: string | null, unreadOnly: boolean) => void
}

const ALL_ARTISTS = 'all-artists'

export function MessageSearch({ artists, onSearch }: MessageSearchProps) {
  const [artistId, setArtistId] = useState<string>(ALL_ARTISTS)
  const [unreadOnly, setUnreadOnly] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onSearch('', artistId === ALL_ARTISTS ? null : artistId, unreadOnly)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [artistId, onSearch, unreadOnly])

  const hasFilters = artistId !== ALL_ARTISTS || unreadOnly

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Select value={artistId} onValueChange={setArtistId}>
        <SelectTrigger aria-label="Filter by artist" className="h-7 text-xs w-36">
          <SelectValue placeholder="All artists" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ARTISTS}>All artists</SelectItem>
          {artists.map((artist) => (
            <SelectItem key={artist.id} value={artist.id}>
              {artist.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={unreadOnly ? 'default' : 'outline'}
        className="h-7 text-xs"
        aria-pressed={unreadOnly}
        onClick={() => setUnreadOnly((current) => !current)}
      >
        Unread only
      </Button>
      {hasFilters && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            setArtistId(ALL_ARTISTS)
            setUnreadOnly(false)
          }}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface MessageSearchProps {
  artists: Array<{ id: string; name: string }>
  onSearch: (query: string, artistId: string | null, unreadOnly: boolean) => void
}

const ALL_ARTISTS = 'all-artists'

export function MessageSearch({ artists, onSearch }: MessageSearchProps) {
  const [query, setQuery] = useState('')
  const [artistId, setArtistId] = useState<string>(ALL_ARTISTS)
  const [unreadOnly, setUnreadOnly] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onSearch(query, artistId === ALL_ARTISTS ? null : artistId, unreadOnly)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [artistId, onSearch, query, unreadOnly])

  const hasFilters = query.trim().length > 0 || artistId !== ALL_ARTISTS || unreadOnly

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search messages…"
        aria-label="Search messages"
        className="md:flex-1"
      />
      <Select value={artistId} onValueChange={setArtistId}>
        <SelectTrigger aria-label="Filter by artist" className="w-full md:w-56">
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
        variant={unreadOnly ? 'default' : 'outline'}
        className="min-h-[44px]"
        aria-pressed={unreadOnly}
        onClick={() => setUnreadOnly((current) => !current)}
      >
        Unread only
      </Button>
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px]"
          onClick={() => {
            setQuery('')
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

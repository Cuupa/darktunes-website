'use client'

import { type RefObject, useCallback, useEffect, useState } from 'react'
import { ListBullets, MagnifyingGlass, SquaresFour, Trash, UploadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BulkPressAction, PressFilters, SortDir, SortField, ViewMode } from '@/hooks/useFileExplorer'

const R2_FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface ExplorerToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  searchInputRef?: RefObject<HTMLInputElement | null>
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortField: SortField
  sortDir: SortDir
  onSortChange: (field: SortField, dir: SortDir) => void
  itemCount: number
  selectedCount: number
  onCreateFolder: () => void
  onDeleteSelected: () => void
  onUpload: () => void
  /** Token used to authenticate the storage-stats API call. */
  authToken?: string | null
  pressFilters?: PressFilters
  onPressFiltersChange?: (filters: PressFilters) => void
  selectedFileCount?: number
  onBulkPress?: (action: BulkPressAction, kitArtistId?: string | null) => void
  artists?: Array<{ id: string; name: string }>
}

export function ExplorerToolbar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  viewMode,
  onViewModeChange,
  sortField,
  sortDir,
  onSortChange,
  itemCount,
  selectedCount,
  onCreateFolder,
  onDeleteSelected,
  onUpload,
  authToken,
  pressFilters,
  onPressFiltersChange,
  selectedFileCount = 0,
  onBulkPress,
  artists = [],
}: ExplorerToolbarProps) {
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const [bulkKitArtistId, setBulkKitArtistId] = useState<string>('label')

  const fetchStats = useCallback(() => {
    if (!authToken) return
    void fetch('/api/admin/assets/storage-stats', {
      headers: { Authorization: 'Bearer ' + authToken },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json && typeof json === 'object' && 'usedBytes' in json) {
          setUsedBytes(json.usedBytes as number)
        }
      })
      .catch(() => undefined)
  }, [authToken])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const usedPct = usedBytes !== null ? Math.min(100, (usedBytes / R2_FREE_TIER_BYTES) * 100) : null

  const updatePressFilter = (patch: Partial<PressFilters>) => {
    if (!pressFilters || !onPressFiltersChange) return
    onPressFiltersChange({ ...pressFilters, ...patch })
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
      {pressFilters && onPressFiltersChange && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={pressFilters.pressOnly ? 'default' : 'outline'}
            onClick={() => updatePressFilter({ pressOnly: !pressFilters.pressOnly })}
            aria-pressed={pressFilters.pressOnly}
          >
            Press only
          </Button>
          <Button
            type="button"
            size="sm"
            variant={pressFilters.pressSuggested ? 'default' : 'outline'}
            onClick={() => updatePressFilter({ pressSuggested: !pressFilters.pressSuggested })}
            aria-pressed={pressFilters.pressSuggested}
          >
            Suggestions
          </Button>
          <Select
            value={pressFilters.pressCategory ?? 'all'}
            onValueChange={(value) => updatePressFilter({ pressCategory: value === 'all' ? null : value })}
          >
            <SelectTrigger className="h-8 w-36" aria-label="Filter by press category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="promo">Promo</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="stage">Stage</SelectItem>
              <SelectItem value="artwork">Artwork</SelectItem>
              <SelectItem value="logo">Logo</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={pressFilters.artistId ?? 'all'}
            onValueChange={(value) => updatePressFilter({ artistId: value === 'all' ? null : value })}
          >
            <SelectTrigger className="h-8 w-40" aria-label="Filter by artist">
              <SelectValue placeholder="Artist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All artists</SelectItem>
              {artists.map((artist) => (
                <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedFileCount > 0 && onBulkPress && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 p-2">
          <span className="text-xs text-muted-foreground">{selectedFileCount} file(s) selected</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onBulkPress('approve')}>
            Approve press
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onBulkPress('unapprove')}>
            Unapprove
          </Button>
          <Select value={bulkKitArtistId} onValueChange={setBulkKitArtistId}>
            <SelectTrigger className="h-8 w-36" aria-label="Press kit target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="label">Label-wide</SelectItem>
              {artists.map((artist) => (
                <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onBulkPress('addToKit', bulkKitArtistId === 'label' ? null : bulkKitArtistId)}
          >
            Add to kit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onBulkPress('removeFromKit', bulkKitArtistId === 'label' ? null : bulkKitArtistId)}
          >
            Remove from kit
          </Button>
        </div>
      )}

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by filename… (Ctrl+F)"
            className="pl-9"
            aria-label="Search assets"
          />
        </div>
        <Select value={`${sortField}:${sortDir}`} onValueChange={(value) => {
          const [field, dir] = value.split(':') as [SortField, SortDir]
          onSortChange(field, dir)
        }}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date:desc">Newest first</SelectItem>
            <SelectItem value="date:asc">Oldest first</SelectItem>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
            <SelectItem value="name:desc">Name Z–A</SelectItem>
            <SelectItem value="size:desc">Largest first</SelectItem>
            <SelectItem value="size:asc">Smallest first</SelectItem>
            <SelectItem value="type:asc">Type A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {usedPct !== null && (
          <div className="flex min-w-40 flex-col gap-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>R2 Storage</span>
              <span>{formatBytes(usedBytes!)} / 10 GB</span>
            </div>
            <Progress value={usedPct} className="h-1.5" aria-label="R2 storage usage" />
          </div>
        )}
        <span className="text-sm text-muted-foreground">{itemCount} item(s)</span>
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Button type="button" variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => onViewModeChange('list')} aria-label="List view">
            <ListBullets size={16} aria-hidden="true" />
          </Button>
          <Button type="button" variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => onViewModeChange('grid')} aria-label="Grid view">
            <SquaresFour size={16} aria-hidden="true" />
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={onCreateFolder}>New Folder</Button>
        <Button type="button" variant="outline" className="gap-2" onClick={onUpload}>
          <UploadSimple size={16} aria-hidden="true" />
          Upload
        </Button>
        {selectedCount > 0 && (
          <Button type="button" variant="destructive" className="gap-2" onClick={onDeleteSelected}>
            <Trash size={16} aria-hidden="true" />
            Delete ({selectedCount})
          </Button>
        )}
      </div>
    </div>
    </div>
  )
}

'use client'

import { ListBullets, MagnifyingGlass, SquaresFour, Trash, UploadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SortDir, SortField, ViewMode } from '@/hooks/useFileExplorer'

interface ExplorerToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
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
}

export function ExplorerToolbar({
  searchQuery,
  onSearchChange,
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
}: ExplorerToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by filename…"
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
  )
}

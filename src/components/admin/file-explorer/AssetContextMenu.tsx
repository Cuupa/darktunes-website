'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Copy, DownloadSimple, Eye, FolderSimple, MagnifyingGlass, PencilSimple, Plus, Tag, Trash, UserCircle, VinylRecord } from '@phosphor-icons/react'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import type { Artist, AssetFolder, Release } from '@/types'
import { getFolderPathLabel } from './utils'

interface AssetContextMenuProps {
  children: ReactNode
  folders: AssetFolder[]
  artists: Artist[]
  releases?: Release[]
  folderId?: string | null
  itemType: 'file' | 'folder'
  selectedArtistIds?: string[]
  selectedReleaseId?: string
  onRename: () => void
  onDelete: () => void
  onCreateSubfolder?: () => void
  onMoveToFolder?: (folderId: string | null) => void
  onDownload?: () => void
  onCopyUrl?: () => void
  onAssignArtists?: (artistIds: string[]) => void
  onAssignRelease?: (releaseId: string | null) => void
  onEditTags?: () => void
  onPreview?: () => void
}

export function AssetContextMenu({
  children,
  folders,
  artists,
  releases = [],
  folderId,
  itemType,
  selectedArtistIds = [],
  selectedReleaseId,
  onRename,
  onDelete,
  onCreateSubfolder,
  onMoveToFolder,
  onDownload,
  onCopyUrl,
  onAssignArtists,
  onAssignRelease,
  onEditTags,
  onPreview,
}: AssetContextMenuProps) {
  const [artistSearch, setArtistSearch] = useState('')
  const [releaseSearch, setReleaseSearch] = useState('')

  const filteredArtists = useMemo(
    () => artists.filter((a) => a.name.toLowerCase().includes(artistSearch.toLowerCase())),
    [artists, artistSearch],
  )

  const filteredReleases = useMemo(
    () => releases.filter(
      (r) => r.title.toLowerCase().includes(releaseSearch.toLowerCase()) ||
             r.artistName.toLowerCase().includes(releaseSearch.toLowerCase()),
    ),
    [releases, releaseSearch],
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {itemType === 'file' && onPreview && (
          <ContextMenuItem className="gap-2" onClick={onPreview}>
            <Eye aria-hidden="true" />
            Preview
          </ContextMenuItem>
        )}

        <ContextMenuItem className="gap-2" onClick={onRename}>
          <PencilSimple aria-hidden="true" />
          Rename
        </ContextMenuItem>

        {onMoveToFolder && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <FolderSimple aria-hidden="true" />
              Move to…
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-72 overflow-y-auto">
              <ContextMenuItem onClick={() => onMoveToFolder(null)}>Root</ContextMenuItem>
              {folders.map((folder) => (
                <ContextMenuItem
                  key={folder.id}
                  disabled={folder.id === folderId}
                  onClick={() => onMoveToFolder(folder.id)}
                >
                  {getFolderPathLabel(folder.id, folders)}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {itemType === 'folder' && onCreateSubfolder && (
          <ContextMenuItem className="gap-2" onClick={onCreateSubfolder}>
            <Plus aria-hidden="true" />
            Create subfolder
          </ContextMenuItem>
        )}

        {/* ── Artist assignment — hierarchical submenu ── */}
        {itemType === 'file' && onAssignArtists && (
          <ContextMenuSub onOpenChange={(open) => { if (!open) setArtistSearch('') }}>
            <ContextMenuSubTrigger className="gap-2">
              <UserCircle aria-hidden="true" />
              Assign artists
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52 p-0">
              <div className="relative border-b border-border px-2 py-1.5">
                <MagnifyingGlass
                  size={12}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search artists…"
                  className="h-7 pl-7 text-xs"
                  autoFocus={false}
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredArtists.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">No artists found</p>
                ) : (
                  filteredArtists.map((artist) => (
                    <ContextMenuCheckboxItem
                      key={artist.id}
                      checked={selectedArtistIds.includes(artist.id)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...selectedArtistIds, artist.id]
                          : selectedArtistIds.filter((id) => id !== artist.id)
                        onAssignArtists(next)
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {artist.name}
                    </ContextMenuCheckboxItem>
                  ))
                )}
              </div>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* ── Release assignment — hierarchical submenu ── */}
        {itemType === 'file' && onAssignRelease && (
          <ContextMenuSub onOpenChange={(open) => { if (!open) setReleaseSearch('') }}>
            <ContextMenuSubTrigger className="gap-2">
              <VinylRecord aria-hidden="true" />
              Assign release
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-60 p-0">
              <div className="relative border-b border-border px-2 py-1.5">
                <MagnifyingGlass
                  size={12}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={releaseSearch}
                  onChange={(e) => setReleaseSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search releases…"
                  className="h-7 pl-7 text-xs"
                  autoFocus={false}
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                <ContextMenuRadioGroup
                  value={selectedReleaseId ?? ''}
                  onValueChange={(value) => onAssignRelease(value === '' ? null : value)}
                >
                  <ContextMenuRadioItem value="" onSelect={(e) => e.preventDefault()}>
                    None
                  </ContextMenuRadioItem>
                  {filteredReleases.length === 0 && releaseSearch ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">No releases found</p>
                  ) : (
                    filteredReleases.map((release) => (
                      <ContextMenuRadioItem
                        key={release.id}
                        value={release.id}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <span className="min-w-0 flex-1 truncate">{release.title}</span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{release.artistName}</span>
                      </ContextMenuRadioItem>
                    ))
                  )}
                </ContextMenuRadioGroup>
              </div>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {itemType === 'file' && onEditTags && (
          <ContextMenuItem className="gap-2" onClick={onEditTags}>
            <Tag aria-hidden="true" />
            Edit tags
          </ContextMenuItem>
        )}

        {itemType === 'file' && onDownload && (
          <ContextMenuItem className="gap-2" onClick={onDownload}>
            <DownloadSimple aria-hidden="true" />
            Download
          </ContextMenuItem>
        )}

        {itemType === 'file' && onCopyUrl && (
          <ContextMenuItem className="gap-2" onClick={onCopyUrl}>
            <Copy aria-hidden="true" />
            Copy URL
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2" onClick={onDelete} variant="destructive">
          <Trash aria-hidden="true" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

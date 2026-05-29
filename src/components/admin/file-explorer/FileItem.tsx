'use client'

import { useEffect, useRef, useState } from 'react'
import NextImage from 'next/image'
import { File, MusicNotes, Tag } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Artist, Asset, AssetFolder, Release } from '@/types'
import { AssetContextMenu } from './AssetContextMenu'
import { InlineAudioPlayer } from './InlineAudioPlayer'
import { formatBytes, formatDate, isAudioAsset, isImageAsset } from './utils'

interface FileItemProps {
  asset: Asset
  artists: Artist[]
  releases: Release[]
  folders: AssetFolder[]
  artistName?: string
  viewMode: 'grid' | 'list'
  selected: boolean
  renaming: boolean
  onSelect: (multi: boolean) => void
  onRename: () => void
  onRenameCommit: (name: string) => void
  onDelete: () => void
  onMoveToFolder: (folderId: string | null) => void
  onCopyUrl: () => void
  onDownload: () => void
  onAssignArtists: (artistIds: string[]) => void
  onAssignRelease: (releaseId: string | null) => void
  onEditTags: () => void
  onPreview: () => void
}

function FilePreview({ asset }: { asset: Asset }) {
  if (isImageAsset(asset)) {
    return (
      <NextImage
        src={asset.publicUrl}
        alt={`${asset.originalFilename} preview`}
        width={200}
        height={64}
        className="h-16 w-full rounded-md border border-border object-cover"
        unoptimized
      />
    )
  }

  if (isAudioAsset(asset)) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-border bg-background/60">
        <MusicNotes size={22} className="text-secondary" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="flex h-16 items-center justify-center rounded-md border border-border bg-background/60">
      <File size={22} className="text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

export function FileItem({
  asset,
  artists,
  releases,
  folders,
  artistName,
  viewMode,
  selected,
  renaming,
  onSelect,
  onRename,
  onRenameCommit,
  onDelete,
  onMoveToFolder,
  onCopyUrl,
  onDownload,
  onAssignArtists,
  onAssignRelease,
  onEditTags,
  onPreview,
}: FileItemProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(asset.originalFilename)

  useEffect(() => {
    if (renaming) {
      setDraftName(asset.originalFilename)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [asset.originalFilename, renaming])

  const content = (
    <div
      data-explorer-item-id={asset.id}
      className={cn(
        'rounded-lg border border-border bg-card/60 transition-colors',
        viewMode === 'grid'
          ? 'flex min-h-40 flex-col gap-3 p-3'
          : 'grid min-h-14 grid-cols-[28px_56px_minmax(0,1fr)_140px_110px_120px_110px] items-center gap-3 px-3 py-2',
        selected && 'border-primary bg-primary/10',
      )}
      onClick={(event) => onSelect(event.metaKey || event.ctrlKey || event.shiftKey)}
      onDoubleClick={onPreview}
    >
      {viewMode === 'list' && <div className="size-4 rounded-full border border-border" aria-hidden="true" />}
      <div className={cn(viewMode === 'list' ? 'w-14' : 'w-full')}>
        <FilePreview asset={asset} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {renaming ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => onRenameCommit(draftName)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRenameCommit(draftName)
              if (event.key === 'Escape') setDraftName(asset.originalFilename)
            }}
            className="h-8"
            aria-label={`Rename file ${asset.originalFilename}`}
          />
        ) : (
          <button
            type="button"
            className="block w-full truncate text-left font-medium outline-none"
            onClick={(event) => {
              event.stopPropagation()
              if (selected) onRename()
              else onSelect(event.metaKey || event.ctrlKey || event.shiftKey)
            }}
          >
            {asset.originalFilename}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{asset.mimeType}</span>
          <span>{formatBytes(asset.sizeBytes)}</span>
          {asset.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-secondary">
              <Tag size={10} aria-hidden="true" />
              {asset.tags.join(', ')}
            </span>
          )}
        </div>
        {viewMode === 'grid' && isAudioAsset(asset) ? <InlineAudioPlayer src={asset.publicUrl} /> : null}
      </div>
      {viewMode === 'list' && <span className="truncate text-sm text-muted-foreground">{artistName ?? '—'}</span>}
      {viewMode === 'list' && <span className="text-sm text-muted-foreground">{formatBytes(asset.sizeBytes)}</span>}
      {viewMode === 'list' && <span className="text-sm text-muted-foreground">{formatDate(asset.createdAt)}</span>}
      {viewMode === 'list' && (
        <div className="text-right text-xs text-muted-foreground">
          {isAudioAsset(asset) ? <InlineAudioPlayer src={asset.publicUrl} /> : asset.mimeType.split('/')[1] ?? asset.mimeType}
        </div>
      )}
    </div>
  )

  return (
    <AssetContextMenu
      itemType="file"
      folders={folders}
      artists={artists}
      releases={releases}
      folderId={asset.folderId ?? null}
      selectedArtistIds={asset.artistIds}
      selectedReleaseId={asset.releaseId ?? undefined}
      onRename={onRename}
      onDelete={onDelete}
      onMoveToFolder={onMoveToFolder}
      onDownload={onDownload}
      onCopyUrl={onCopyUrl}
      onAssignArtists={onAssignArtists}
      onAssignRelease={onAssignRelease}
      onEditTags={onEditTags}
      onPreview={onPreview}
    >
      {content}
    </AssetContextMenu>
  )
}

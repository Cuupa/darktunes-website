'use client'

import { useEffect, useRef, useState } from 'react'
import { CaretRight, FolderOpen, FolderSimple, MusicNote } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Artist, AssetFolder } from '@/types'
import { AssetContextMenu } from './AssetContextMenu'

interface FolderItemProps {
  folder: AssetFolder
  folders: AssetFolder[]
  artists: Artist[]
  viewMode: 'grid' | 'list'
  selected: boolean
  renaming: boolean
  onNavigate: (folderId: string) => void
  onSelect: (multi: boolean) => void
  onRename: () => void
  onRenameCommit: (name: string) => void
  onDelete: () => void
  onCreateSubfolder: () => void
  onMoveToFolder: (folderId: string | null) => void
  onFilesDropped: (files: File[], folderId: string) => void
}

export function FolderItem({
  folder,
  folders,
  artists,
  viewMode,
  selected,
  renaming,
  onNavigate,
  onSelect,
  onRename,
  onRenameCommit,
  onDelete,
  onCreateSubfolder,
  onMoveToFolder,
  onFilesDropped,
}: FolderItemProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draftName, setDraftName] = useState(folder.name)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (renaming) {
      setDraftName(folder.name)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [folder.name, renaming])

  const content = (
    <div
      data-explorer-item-id={`folder:${folder.id}`}
      className={cn(
        'group rounded-lg border border-border bg-card/60 transition-colors',
        viewMode === 'grid'
          ? 'flex min-h-32 flex-col justify-between gap-3 p-3'
          : 'grid min-h-14 grid-cols-[32px_minmax(0,1fr)_120px] items-center gap-3 px-3 py-2',
        selected && 'border-primary bg-primary/10',
        isDragOver && 'border-primary bg-primary/10 ring-1 ring-primary',
      )}
      onClick={(event) => onSelect(event.metaKey || event.ctrlKey || event.shiftKey)}
      onDoubleClick={() => onNavigate(folder.id)}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragOver(false)
        const droppedFiles = Array.from(event.dataTransfer.files)
        if (droppedFiles.length > 0) onFilesDropped(droppedFiles, folder.id)
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {folder.artistId ? <MusicNote size={22} className="text-secondary" aria-hidden="true" /> : null}
        {selected ? <FolderOpen size={28} className="text-primary" aria-hidden="true" /> : <FolderSimple size={28} className="text-primary" aria-hidden="true" />}
        {viewMode === 'list' && <CaretRight size={14} className="text-muted-foreground" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <Input
            ref={inputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => onRenameCommit(draftName)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onRenameCommit(draftName)
              if (event.key === 'Escape') setDraftName(folder.name)
            }}
            className="h-8"
            aria-label={`Rename folder ${folder.name}`}
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
            {folder.name}
          </button>
        )}
        <p className="text-xs text-muted-foreground">Folder</p>
      </div>
      {viewMode === 'list' && <span className="text-xs text-muted-foreground">{new Date(folder.updatedAt).toLocaleDateString()}</span>}
    </div>
  )

  return (
    <AssetContextMenu
      itemType="folder"
      folders={folders.filter((item) => item.id !== folder.id)}
      artists={artists}
      folderId={folder.parentId}
      onRename={onRename}
      onDelete={onDelete}
      onCreateSubfolder={onCreateSubfolder}
      onMoveToFolder={onMoveToFolder}
    >
      {content}
    </AssetContextMenu>
  )
}

'use client'

import { useState, type ReactNode } from 'react'
import { Copy, DownloadSimple, Eye, FolderSimple, PencilSimple, Plus, Tag, Trash, UserCircle, Vinyl } from '@phosphor-icons/react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Artist, AssetFolder, Release } from '@/types'
import { AssignArtistDialog, AssignReleaseDialog } from './AssetAssignDialog'
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
  const [artistDialogOpen, setArtistDialogOpen] = useState(false)
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {itemType === 'file' && onPreview && (
            <ContextMenuItem onClick={onPreview}>
              <Eye aria-hidden="true" />
              Preview
            </ContextMenuItem>
          )}

          <ContextMenuItem onClick={onRename}>
            <PencilSimple aria-hidden="true" />
            Rename
          </ContextMenuItem>

          {onMoveToFolder && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
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
            <ContextMenuItem onClick={onCreateSubfolder}>
              <Plus aria-hidden="true" />
              Create subfolder
            </ContextMenuItem>
          )}

          {itemType === 'file' && onAssignArtists && (
            <ContextMenuItem onSelect={(e) => { e.preventDefault(); setArtistDialogOpen(true) }}>
              <UserCircle aria-hidden="true" />
              Assign artists…
            </ContextMenuItem>
          )}

          {itemType === 'file' && onAssignRelease && (
            <ContextMenuItem onSelect={(e) => { e.preventDefault(); setReleaseDialogOpen(true) }}>
              <Vinyl aria-hidden="true" />
              Assign release…
            </ContextMenuItem>
          )}

          {itemType === 'file' && onEditTags && (
            <ContextMenuItem onClick={onEditTags}>
              <Tag aria-hidden="true" />
              Edit tags
            </ContextMenuItem>
          )}

          {itemType === 'file' && onDownload && (
            <ContextMenuItem onClick={onDownload}>
              <DownloadSimple aria-hidden="true" />
              Download
            </ContextMenuItem>
          )}

          {itemType === 'file' && onCopyUrl && (
            <ContextMenuItem onClick={onCopyUrl}>
              <Copy aria-hidden="true" />
              Copy URL
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} variant="destructive">
            <Trash aria-hidden="true" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {onAssignArtists && (
        <AssignArtistDialog
          open={artistDialogOpen}
          onClose={() => setArtistDialogOpen(false)}
          artists={artists}
          selectedArtistIds={selectedArtistIds}
          onConfirm={onAssignArtists}
        />
      )}

      {onAssignRelease && (
        <AssignReleaseDialog
          open={releaseDialogOpen}
          onClose={() => setReleaseDialogOpen(false)}
          releases={releases}
          selectedReleaseId={selectedReleaseId}
          onConfirm={onAssignRelease}
        />
      )}
    </>
  )
}

'use client'

import type { ReactNode } from 'react'
import { Copy, DownloadSimple, FolderSimple, PencilSimple, Plus, Tag, Trash, UserCircle } from '@phosphor-icons/react'
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
import type { Artist, AssetFolder } from '@/types'
import { getFolderPathLabel } from './utils'

interface AssetContextMenuProps {
  children: ReactNode
  folders: AssetFolder[]
  artists: Artist[]
  folderId?: string | null
  itemType: 'file' | 'folder'
  onRename: () => void
  onDelete: () => void
  onCreateSubfolder?: () => void
  onMoveToFolder?: (folderId: string | null) => void
  onDownload?: () => void
  onCopyUrl?: () => void
  onAssignArtist?: (artistId: string | null) => void
  onEditTags?: () => void
}

export function AssetContextMenu({
  children,
  folders,
  artists,
  folderId,
  itemType,
  onRename,
  onDelete,
  onCreateSubfolder,
  onMoveToFolder,
  onDownload,
  onCopyUrl,
  onAssignArtist,
  onEditTags,
}: AssetContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
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
            <ContextMenuSubContent className="max-h-72">
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

        {itemType === 'file' && onAssignArtist && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <UserCircle aria-hidden="true" />
              Assign artist
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-72">
              <ContextMenuItem onClick={() => onAssignArtist(null)}>Unassigned</ContextMenuItem>
              {artists.map((artist) => (
                <ContextMenuItem key={artist.id} onClick={() => onAssignArtist(artist.id)}>
                  {artist.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
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
  )
}

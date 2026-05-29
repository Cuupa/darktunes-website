'use client'

import type { MouseEvent as ReactMouseEvent } from 'react'
import { useRef, useState } from 'react'
import type { Artist, Asset, AssetFolder, Release } from '@/types'
import { FileItem } from './FileItem'
import { FolderItem } from './FolderItem'

interface RenamingState {
  type: 'file' | 'folder'
  id: string
}

interface FileGridProps {
  folders: AssetFolder[]
  assets: Asset[]
  allFolders: AssetFolder[]
  artists: Artist[]
  releases: Release[]
  selectedIds: Set<string>
  renaming: RenamingState | null
  artistNames: Record<string, string>
  onSelectionReplace: (ids: string[]) => void
  onFolderSelect: (folderId: string, multi: boolean) => void
  onFolderNavigate: (folderId: string) => void
  onFolderRenameStart: (folderId: string) => void
  onFolderRenameCommit: (folderId: string, name: string) => void
  onFolderDelete: (folderId: string) => void
  onFolderCreate: (parentId: string | null) => void
  onFolderMove: (folderId: string, parentId: string | null) => void
  onFolderFilesDropped: (files: File[], folderId: string) => void
  onAssetSelect: (assetId: string, multi: boolean) => void
  onAssetRenameStart: (assetId: string) => void
  onAssetRenameCommit: (assetId: string, name: string) => void
  onAssetDelete: (assetId: string) => void
  onAssetMove: (assetId: string, folderId: string | null) => void
  onAssetCopyUrl: (asset: Asset) => void
  onAssetDownload: (asset: Asset) => void
  onAssetAssignArtists: (assetId: string, artistIds: string[]) => void
  onAssetAssignRelease: (assetId: string, releaseId: string | null) => void
  onAssetEditTags: (asset: Asset) => void
  onAssetPreview: (asset: Asset) => void
}

export function FileGrid({
  folders,
  assets,
  allFolders,
  artists,
  releases,
  selectedIds,
  renaming,
  artistNames,
  onSelectionReplace,
  onFolderSelect,
  onFolderNavigate,
  onFolderRenameStart,
  onFolderRenameCommit,
  onFolderDelete,
  onFolderCreate,
  onFolderMove,
  onFolderFilesDropped,
  onAssetSelect,
  onAssetRenameStart,
  onAssetRenameCommit,
  onAssetDelete,
  onAssetMove,
  onAssetCopyUrl,
  onAssetDownload,
  onAssetAssignArtists,
  onAssetAssignRelease,
  onAssetEditTags,
  onAssetPreview,
}: FileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const startSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-explorer-item-id]')) return
    const startX = event.clientX
    const startY = event.clientY
    const handleMove = (moveEvent: MouseEvent) => {
      const x = Math.min(startX, moveEvent.clientX)
      const y = Math.min(startY, moveEvent.clientY)
      const nextRect = { x, y, width: Math.abs(moveEvent.clientX - startX), height: Math.abs(moveEvent.clientY - startY) }
      selectionRef.current = nextRect
      setSelectionRect(nextRect)
    }

    const handleUp = () => {
      const rect = selectionRef.current
      if (rect && containerRef.current) {
        const ids = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-explorer-item-id]'))
          .filter((node) => {
            const box = node.getBoundingClientRect()
            return rect.x < box.right && rect.x + rect.width > box.left && rect.y < box.bottom && rect.y + rect.height > box.top
          })
          .map((node) => node.dataset.explorerItemId)
          .filter((value): value is string => typeof value === 'string')
        onSelectionReplace(ids)
      }
      selectionRef.current = null
      setSelectionRect(null)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto p-4" onMouseDown={startSelection}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            folders={allFolders}
            artists={artists}
            viewMode="grid"
            selected={selectedIds.has(`folder:${folder.id}`)}
            renaming={renaming?.type === 'folder' && renaming.id === folder.id}
            onNavigate={onFolderNavigate}
            onSelect={(multi) => onFolderSelect(folder.id, multi)}
            onRename={() => onFolderRenameStart(folder.id)}
            onRenameCommit={(name) => onFolderRenameCommit(folder.id, name)}
            onDelete={() => onFolderDelete(folder.id)}
            onCreateSubfolder={() => onFolderCreate(folder.id)}
            onMoveToFolder={(parentId) => onFolderMove(folder.id, parentId)}
            onFilesDropped={onFolderFilesDropped}
          />
        ))}
        {assets.map((asset) => (
          <FileItem
            key={asset.id}
            asset={asset}
            artists={artists}
            releases={releases}
            folders={allFolders}
            artistName={asset.artistId ? artistNames[asset.artistId] : undefined}
            viewMode="grid"
            selected={selectedIds.has(asset.id)}
            renaming={renaming?.type === 'file' && renaming.id === asset.id}
            onSelect={(multi) => onAssetSelect(asset.id, multi)}
            onRename={() => onAssetRenameStart(asset.id)}
            onRenameCommit={(name) => onAssetRenameCommit(asset.id, name)}
            onDelete={() => onAssetDelete(asset.id)}
            onMoveToFolder={(folderId) => onAssetMove(asset.id, folderId)}
            onCopyUrl={() => onAssetCopyUrl(asset)}
            onDownload={() => onAssetDownload(asset)}
            onAssignArtists={(artistIds) => onAssetAssignArtists(asset.id, artistIds)}
            onAssignRelease={(releaseId) => onAssetAssignRelease(asset.id, releaseId)}
            onEditTags={() => onAssetEditTags(asset)}
            onPreview={() => onAssetPreview(asset)}
          />
        ))}
      </div>
      {selectionRect && (
        <div
          className="pointer-events-none fixed z-10 border border-primary bg-primary/10"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        />
      )}
    </div>
  )
}

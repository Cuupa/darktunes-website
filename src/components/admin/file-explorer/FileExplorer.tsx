'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useArtists } from '@/hooks/useArtists'
import { useFileExplorer } from '@/hooks/useFileExplorer'
import { cn } from '@/lib/utils'
import type { Asset } from '@/types'
import { ExplorerBreadcrumb } from './ExplorerBreadcrumb'
import { ExplorerToolbar } from './ExplorerToolbar'
import { FileGrid } from './FileGrid'
import { FileList } from './FileList'
import { FolderTree } from './FolderTree'
import { UploadDropZone, type UploadDropZoneRef } from './UploadDropZone'

interface RenamingState {
  type: 'file' | 'folder'
  id: string
}

export function FileExplorer({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = searchParams.get('folder') ?? null
  const explorer = useFileExplorer(folderId)
  const { artists } = useArtists()
  const uploadRef = useRef<UploadDropZoneRef>(null)
  const [renaming, setRenaming] = useState<RenamingState | null>(null)

  const artistNames = useMemo(
    () => Object.fromEntries(artists.map((artist) => [artist.id, artist.name])),
    [artists],
  )

  const navigate = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('folder', id)
    else params.delete('folder')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
    explorer.navigateTo(id)
  }, [explorer, pathname, router, searchParams])

  const replaceSelection = useCallback((ids: string[]) => {
    explorer.clearSelection()
    ids.forEach((id) => explorer.toggleSelect(id, true))
  }, [explorer])

  const createFolder = useCallback(async (parentId: string | null) => {
    const name = window.prompt('Folder name')?.trim()
    if (!name) return
    try {
      await explorer.createFolder(name, parentId, null)
      toast.success(`Created folder “${name}”`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create folder')
    }
  }, [explorer])

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const nextName = name.trim()
    setRenaming(null)
    if (!nextName) return
    try {
      await explorer.renameFolder(folderId, nextName)
      toast.success('Folder renamed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename folder')
    }
  }, [explorer])

  const renameAsset = useCallback(async (assetId: string, name: string) => {
    const nextName = name.trim()
    setRenaming(null)
    if (!nextName) return
    try {
      await explorer.updateAsset(assetId, { originalFilename: nextName })
      toast.success('File renamed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename file')
    }
  }, [explorer])

  const deleteSelected = useCallback(async () => {
    const fileIds = [...explorer.selectedIds].filter((id) => !id.startsWith('folder:'))
    const folderIds = [...explorer.selectedIds].filter((id) => id.startsWith('folder:')).map((id) => id.replace('folder:', ''))
    if (fileIds.length === 0 && folderIds.length === 0) return
    if (!window.confirm(`Delete ${fileIds.length + folderIds.length} selected item(s)?`)) return

    try {
      if (fileIds.length === 1) await explorer.deleteAsset(fileIds[0])
      else if (fileIds.length > 1) await explorer.batchDelete(fileIds)

      for (const currentFolderId of folderIds) {
        await explorer.deleteFolder(currentFolderId)
      }

      explorer.clearSelection()
      toast.success('Selection deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    }
  }, [explorer])

  const handleAssetTags = useCallback(async (asset: Asset) => {
    const value = window.prompt('Comma-separated tags', asset.tags.join(', '))
    if (value === null) return
    const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean)
    try {
      await explorer.updateAsset(asset.id, { tags })
      toast.success('Tags updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tags')
    }
  }, [explorer])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && explorer.selectedIds.size > 0) {
        event.preventDefault()
        void deleteSelected()
      }
      if (event.key === 'Escape') {
        explorer.clearSelection()
        setRenaming(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, explorer])

  const displayedFolders = explorer.searchQuery.trim() ? [] : explorer.folders
  const displayedAssets = explorer.searchQuery.trim() ? explorer.searchResults : explorer.assets

  return (
    <ResizablePanelGroup direction="horizontal" className={cn('h-[calc(100vh-10rem)] rounded-lg border border-border bg-background', className)}>
      <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
        <FolderTree
          folders={explorer.allFolders}
          currentFolderId={explorer.currentFolderId}
          onNavigate={navigate}
          onCreateRootFolder={() => void createFolder(null)}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80}>
        <div className="flex h-full flex-col">
          <ExplorerToolbar
            searchQuery={explorer.searchQuery}
            onSearchChange={explorer.setSearchQuery}
            viewMode={explorer.viewMode}
            onViewModeChange={explorer.setViewMode}
            sortField={explorer.sortField}
            sortDir={explorer.sortDir}
            onSortChange={explorer.setSort}
            itemCount={displayedFolders.length + displayedAssets.length}
            selectedCount={explorer.selectedIds.size}
            onCreateFolder={() => void createFolder(explorer.currentFolderId)}
            onDeleteSelected={() => void deleteSelected()}
            onUpload={() => uploadRef.current?.openPicker()}
          />
          <ExplorerBreadcrumb path={explorer.folderPath} onNavigate={navigate} />
          <UploadDropZone ref={uploadRef} folderId={explorer.currentFolderId} token={explorer.token} onUploadComplete={explorer.reload}>
            {explorer.viewMode === 'grid' ? (
              <FileGrid
                folders={displayedFolders}
                assets={displayedAssets}
                allFolders={explorer.allFolders}
                artists={artists}
                selectedIds={explorer.selectedIds}
                renaming={renaming}
                artistNames={artistNames}
                onSelectionReplace={replaceSelection}
                onFolderSelect={(currentFolderId, multi) => explorer.toggleSelect(`folder:${currentFolderId}`, multi)}
                onFolderNavigate={navigate}
                onFolderRenameStart={(currentFolderId) => setRenaming({ type: 'folder', id: currentFolderId })}
                onFolderRenameCommit={(currentFolderId, name) => void renameFolder(currentFolderId, name)}
                onFolderDelete={(currentFolderId) => void explorer.deleteFolder(currentFolderId).then(() => toast.success('Folder deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))}
                onFolderCreate={(parentId) => void createFolder(parentId)}
                onFolderMove={(currentFolderId, parentId) => void explorer.moveFolder(currentFolderId, parentId).then(() => toast.success('Folder moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))}
                onFolderFilesDropped={(files, currentFolderId) => void uploadRef.current?.uploadToFolder(files, currentFolderId)}
                onAssetSelect={(assetId, multi) => explorer.toggleSelect(assetId, multi)}
                onAssetRenameStart={(assetId) => setRenaming({ type: 'file', id: assetId })}
                onAssetRenameCommit={(assetId, name) => void renameAsset(assetId, name)}
                onAssetDelete={(assetId) => void explorer.deleteAsset(assetId).then(() => toast.success('File deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))}
                onAssetMove={(assetId, currentFolderId) => void explorer.moveAsset(assetId, currentFolderId).then(() => toast.success('File moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))}
                onAssetCopyUrl={(asset) => void navigator.clipboard.writeText(asset.publicUrl).then(() => toast.success('URL copied'))}
                onAssetDownload={(asset) => window.open(asset.publicUrl, '_blank', 'noopener,noreferrer')}
                onAssetAssignArtist={(assetId, artistId) => void explorer.updateAsset(assetId, { artistId }).then(() => toast.success('Artist assigned')).catch((error) => toast.error(error instanceof Error ? error.message : 'Assign failed'))}
                onAssetEditTags={(asset) => void handleAssetTags(asset)}
              />
            ) : (
              <FileList
                folders={displayedFolders}
                assets={displayedAssets}
                allFolders={explorer.allFolders}
                artists={artists}
                selectedIds={explorer.selectedIds}
                renaming={renaming}
                sortField={explorer.sortField}
                sortDir={explorer.sortDir}
                artistNames={artistNames}
                onSortChange={explorer.setSort}
                onSelectionReplace={replaceSelection}
                onFolderSelect={(currentFolderId, multi) => explorer.toggleSelect(`folder:${currentFolderId}`, multi)}
                onFolderNavigate={navigate}
                onFolderRenameStart={(currentFolderId) => setRenaming({ type: 'folder', id: currentFolderId })}
                onFolderRenameCommit={(currentFolderId, name) => void renameFolder(currentFolderId, name)}
                onFolderDelete={(currentFolderId) => void explorer.deleteFolder(currentFolderId).then(() => toast.success('Folder deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))}
                onFolderCreate={(parentId) => void createFolder(parentId)}
                onFolderMove={(currentFolderId, parentId) => void explorer.moveFolder(currentFolderId, parentId).then(() => toast.success('Folder moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))}
                onFolderFilesDropped={(files, currentFolderId) => void uploadRef.current?.uploadToFolder(files, currentFolderId)}
                onAssetSelect={(assetId, multi) => explorer.toggleSelect(assetId, multi)}
                onAssetRenameStart={(assetId) => setRenaming({ type: 'file', id: assetId })}
                onAssetRenameCommit={(assetId, name) => void renameAsset(assetId, name)}
                onAssetDelete={(assetId) => void explorer.deleteAsset(assetId).then(() => toast.success('File deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))}
                onAssetMove={(assetId, currentFolderId) => void explorer.moveAsset(assetId, currentFolderId).then(() => toast.success('File moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))}
                onAssetCopyUrl={(asset) => void navigator.clipboard.writeText(asset.publicUrl).then(() => toast.success('URL copied'))}
                onAssetDownload={(asset) => window.open(asset.publicUrl, '_blank', 'noopener,noreferrer')}
                onAssetAssignArtist={(assetId, artistId) => void explorer.updateAsset(assetId, { artistId }).then(() => toast.success('Artist assigned')).catch((error) => toast.error(error instanceof Error ? error.message : 'Assign failed'))}
                onAssetEditTags={(asset) => void handleAssetTags(asset)}
              />
            )}
          </UploadDropZone>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

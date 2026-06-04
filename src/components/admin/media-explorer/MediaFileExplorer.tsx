'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useArtists } from '@/hooks/useArtists'
import { useMediaExplorer } from '@/hooks/useMediaExplorer'
import { cn } from '@/lib/utils'
import type { Asset } from '@/types'
import { ExplorerBreadcrumb } from '../file-explorer/ExplorerBreadcrumb'
import { ExplorerToolbar } from '../file-explorer/ExplorerToolbar'
import { FileGrid } from '../file-explorer/FileGrid'
import { FileList } from '../file-explorer/FileList'
import { FolderTree } from '../file-explorer/FolderTree'
import { TagsEditorDialog } from '../file-explorer/AssetAssignDialog'
import { AssetPreviewModal } from '../file-explorer/AssetPreviewModal'
import { UploadDropZone, type UploadDropZoneRef } from '../file-explorer/UploadDropZone'

interface RenamingState {
  type: 'file' | 'folder'
  id: string
}

export function MediaFileExplorer({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = searchParams.get('mediafolder') ?? null
  const explorer = useMediaExplorer(folderId)
  const { artists } = useArtists()
  const uploadRef = useRef<UploadDropZoneRef>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [renaming, setRenaming] = useState<RenamingState | null>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [tagsAsset, setTagsAsset] = useState<Asset | null>(null)

  const artistNames = useMemo(
    () => Object.fromEntries(artists.map((artist) => [artist.id, artist.name])),
    [artists],
  )

  const navigate = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('mediafolder', id)
    else params.delete('mediafolder')
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
      await explorer.createFolder(name, parentId)
      toast.success(`Created folder "${name}"`)
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

  const handleAssetTags = useCallback((asset: Asset) => {
    setTagsAsset(asset)
  }, [])

  const handleTagsConfirm = useCallback(async (tags: string[]) => {
    if (!tagsAsset) return
    try {
      await explorer.updateAsset(tagsAsset.id, { tags })
      toast.success('Tags updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tags')
    }
  }, [explorer, tagsAsset])

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
      if ((event.key === 'f' || event.key === 'F') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, explorer])

  const displayedFolders = explorer.searchQuery.trim() ? [] : explorer.folders
  const displayedAssets = explorer.searchQuery.trim() ? explorer.searchResults : explorer.assets

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const handleAssignArtists = useCallback(async (assetId: string, newArtistIds: string[]) => {
    try {
      // media_files supports a single artist_id; take the first value (or null to unassign)
      const artistId = newArtistIds.length > 0 ? newArtistIds[0] : null
      await explorer.updateAsset(assetId, { artistId })
      toast.success(artistId ? 'Artist assigned' : 'Artist removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assign failed')
    }
  }, [explorer])

  const sharedGridListProps = {
    folders: displayedFolders,
    assets: displayedAssets,
    allFolders: explorer.allFolders,
    artists,
    releases: [],
    selectedIds: explorer.selectedIds,
    renaming,
    artistNames,
    onSelectionReplace: replaceSelection,
    onFolderSelect: (currentFolderId: string, multi: boolean) => explorer.toggleSelect(`folder:${currentFolderId}`, multi),
    onFolderNavigate: navigate,
    onFolderRenameStart: (currentFolderId: string) => setRenaming({ type: 'folder', id: currentFolderId }),
    onFolderRenameCommit: (currentFolderId: string, name: string) => void renameFolder(currentFolderId, name),
    onFolderDelete: (currentFolderId: string) => void explorer.deleteFolder(currentFolderId).then(() => toast.success('Folder deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed')),
    onFolderCreate: (parentId: string | null) => void createFolder(parentId),
    onFolderMove: (currentFolderId: string, parentId: string | null) => void explorer.moveFolder(currentFolderId, parentId).then(() => toast.success('Folder moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed')),
    onFolderFilesDropped: (files: File[], currentFolderId: string) => void uploadRef.current?.uploadToFolder(files, currentFolderId),
    onAssetSelect: (assetId: string, multi: boolean) => explorer.toggleSelect(assetId, multi),
    onAssetRenameStart: (assetId: string) => setRenaming({ type: 'file', id: assetId }),
    onAssetRenameCommit: (assetId: string, name: string) => void renameAsset(assetId, name),
    onAssetDelete: (assetId: string) => void explorer.deleteAsset(assetId).then(() => toast.success('File deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed')),
    onAssetMove: (assetId: string, currentFolderId: string | null) => void explorer.moveAsset(assetId, currentFolderId).then(() => toast.success('File moved')).catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed')),
    onAssetCopyUrl: (asset: Asset) => void navigator.clipboard.writeText(asset.publicUrl).then(() => toast.success('URL copied')),
    onAssetDownload: (asset: Asset) => window.open(asset.publicUrl, '_blank', 'noopener,noreferrer'),
    onAssetAssignArtists: (assetId: string, newArtistIds: string[]) => void handleAssignArtists(assetId, newArtistIds),
    onAssetAssignRelease: () => undefined,
    onAssetEditTags: (asset: Asset) => handleAssetTags(asset),
    onAssetPreview: (asset: Asset) => setPreviewAsset(asset),
  }

  return (
    <>
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
              searchInputRef={searchInputRef}
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
            <div className="flex items-center gap-2 border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
              <span>Storage used: <span className="font-medium text-foreground">{formatBytes(explorer.totalStorageBytes)}</span></span>
            </div>
            <UploadDropZone
              ref={uploadRef}
              folderId={explorer.currentFolderId}
              token={explorer.token}
              uploadEndpoint="/api/upload-media"
              onUploadComplete={explorer.reload}
            >
              {explorer.viewMode === 'grid' ? (
                <FileGrid {...sharedGridListProps} />
              ) : (
                <FileList
                  {...sharedGridListProps}
                  sortField={explorer.sortField}
                  sortDir={explorer.sortDir}
                  onSortChange={explorer.setSort}
                />
              )}
            </UploadDropZone>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <AssetPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      <TagsEditorDialog
        open={tagsAsset !== null}
        initialTags={tagsAsset?.tags ?? []}
        onConfirm={(tags) => void handleTagsConfirm(tags)}
        onClose={() => setTagsAsset(null)}
      />
    </>
  )
}

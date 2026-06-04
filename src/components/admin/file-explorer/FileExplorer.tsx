'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useArtists } from '@/hooks/useArtists'
import { useFileExplorer } from '@/hooks/useFileExplorer'
import { useReleases } from '@/hooks/useReleases'
import { cn } from '@/lib/utils'
import type { Asset } from '@/types'
import { ExplorerBreadcrumb } from './ExplorerBreadcrumb'
import { ExplorerToolbar } from './ExplorerToolbar'
import { FileGrid } from './FileGrid'
import { FileList } from './FileList'
import { FolderTree } from './FolderTree'
import { TagsEditorDialog } from './AssetAssignDialog'
import { AssetPreviewModal } from './AssetPreviewModal'
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
  const { releases } = useReleases()
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

  const handleAssignArtists = useCallback(async (assetId: string, artistIds: string[]) => {
    try {
      await explorer.updateAsset(assetId, { artistIds })
      toast.success('Artists assigned')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assign failed')
    }
  }, [explorer])

  const handleAssignRelease = useCallback(async (assetId: string, releaseId: string | null) => {
    try {
      await explorer.updateAsset(assetId, { releaseId })
      toast.success(releaseId ? 'Release assigned' : 'Release unlinked')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Assign failed')
    }
  }, [explorer])

  // ---------------------------------------------------------------------------
  // Multi-selection helpers for context-menu operations
  // When right-clicking an item that is already selected, the operation runs
  // on ALL selected items of the same kind. Otherwise it runs only on that
  // single item (matching the single-click, single-select behaviour).
  // ---------------------------------------------------------------------------

  /** Returns the asset IDs to act on: all selected files when `assetId` is selected, else just `assetId`. */
  const resolveAssetTargets = useCallback((assetId: string): string[] => {
    if (explorer.selectedIds.has(assetId)) {
      return [...explorer.selectedIds].filter((id) => !id.startsWith('folder:'))
    }
    return [assetId]
  }, [explorer.selectedIds])

  /** Returns the folder IDs to act on: all selected folders when `folderId` is selected, else just `folderId`. */
  const resolveFolderTargets = useCallback((folderId: string): string[] => {
    if (explorer.selectedIds.has(`folder:${folderId}`)) {
      return [...explorer.selectedIds]
        .filter((id) => id.startsWith('folder:'))
        .map((id) => id.replace('folder:', ''))
    }
    return [folderId]
  }, [explorer.selectedIds])

  const handleContextAssetDelete = useCallback((assetId: string) => {
    const ids = resolveAssetTargets(assetId)
    const deleteAll = async () => {
      if (ids.length === 1) await explorer.deleteAsset(ids[0])
      else await explorer.batchDelete(ids)
      explorer.clearSelection()
      toast.success(ids.length > 1 ? `${ids.length} files deleted` : 'File deleted')
    }
    void deleteAll().catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))
  }, [explorer, resolveAssetTargets])

  const handleContextAssetMove = useCallback((assetId: string, folderId: string | null) => {
    const ids = resolveAssetTargets(assetId)
    const moveAll = async () => {
      await Promise.all(ids.map((id) => explorer.moveAsset(id, folderId)))
      explorer.clearSelection()
      toast.success(ids.length > 1 ? `${ids.length} files moved` : 'File moved')
    }
    void moveAll().catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))
  }, [explorer, resolveAssetTargets])

  const handleContextFolderDelete = useCallback((folderId: string) => {
    const ids = resolveFolderTargets(folderId)
    const deleteAll = async () => {
      await Promise.all(ids.map((id) => explorer.deleteFolder(id)))
      explorer.clearSelection()
      toast.success(ids.length > 1 ? `${ids.length} folders deleted` : 'Folder deleted')
    }
    void deleteAll().catch((error) => toast.error(error instanceof Error ? error.message : 'Delete failed'))
  }, [explorer, resolveFolderTargets])

  const handleContextFolderMove = useCallback((folderId: string, parentId: string | null) => {
    const ids = resolveFolderTargets(folderId)
    const moveAll = async () => {
      await Promise.all(ids.map((id) => explorer.moveFolder(id, parentId)))
      explorer.clearSelection()
      toast.success(ids.length > 1 ? `${ids.length} folders moved` : 'Folder moved')
    }
    void moveAll().catch((error) => toast.error(error instanceof Error ? error.message : 'Move failed'))
  }, [explorer, resolveFolderTargets])

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

  const sharedGridListProps = {
    folders: displayedFolders,
    assets: displayedAssets,
    allFolders: explorer.allFolders,
    artists,
    releases: releases ?? [],
    selectedIds: explorer.selectedIds,
    renaming,
    artistNames,
    onSelectionReplace: replaceSelection,
    onFolderSelect: (currentFolderId: string, multi: boolean) => explorer.toggleSelect(`folder:${currentFolderId}`, multi),
    onFolderNavigate: navigate,
    onFolderRenameStart: (currentFolderId: string) => setRenaming({ type: 'folder', id: currentFolderId }),
    onFolderRenameCommit: (currentFolderId: string, name: string) => void renameFolder(currentFolderId, name),
    onFolderDelete: (currentFolderId: string) => handleContextFolderDelete(currentFolderId),
    onFolderCreate: (parentId: string | null) => void createFolder(parentId),
    onFolderMove: (currentFolderId: string, parentId: string | null) => handleContextFolderMove(currentFolderId, parentId),
    onFolderFilesDropped: (files: File[], currentFolderId: string) => void uploadRef.current?.uploadToFolder(files, currentFolderId),
    onAssetSelect: (assetId: string, multi: boolean) => explorer.toggleSelect(assetId, multi),
    onAssetRenameStart: (assetId: string) => setRenaming({ type: 'file', id: assetId }),
    onAssetRenameCommit: (assetId: string, name: string) => void renameAsset(assetId, name),
    onAssetDelete: (assetId: string) => handleContextAssetDelete(assetId),
    onAssetMove: (assetId: string, currentFolderId: string | null) => handleContextAssetMove(assetId, currentFolderId),
    onAssetCopyUrl: (asset: Asset) => void navigator.clipboard.writeText(asset.publicUrl).then(() => toast.success('URL copied')),
    onAssetDownload: (asset: Asset) => window.open(asset.publicUrl, '_blank', 'noopener,noreferrer'),
    onAssetAssignArtists: (assetId: string, artistIds: string[]) => void handleAssignArtists(assetId, artistIds),
    onAssetAssignRelease: (assetId: string, releaseId: string | null) => void handleAssignRelease(assetId, releaseId),
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
              authToken={explorer.token}
            />
            <ExplorerBreadcrumb path={explorer.folderPath} onNavigate={navigate} />
            <UploadDropZone ref={uploadRef} folderId={explorer.currentFolderId} token={explorer.token} onUploadComplete={explorer.reload}>
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

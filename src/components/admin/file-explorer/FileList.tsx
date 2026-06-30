'use client'

import { useRef } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SortDir, SortField } from '@/hooks/useFileExplorer'
import type { Artist, Asset, AssetFolder, Release } from '@/types'
import { FileItem } from './FileItem'
import { FolderItem } from './FolderItem'

interface RenamingState {
  type: 'file' | 'folder'
  id: string
}

interface FileListProps {
  folders: AssetFolder[]
  assets: Asset[]
  allFolders: AssetFolder[]
  artists: Artist[]
  releases: Release[]
  selectedIds: Set<string>
  renaming: RenamingState | null
  sortField: SortField
  sortDir: SortDir
  artistNames: Record<string, string>
  onSortChange: (field: SortField, dir: SortDir) => void
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

export function FileList({
  folders,
  assets,
  allFolders,
  artists,
  releases,
  selectedIds,
  renaming,
  sortField,
  sortDir,
  artistNames,
  onSortChange,
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
}: FileListProps) {
  const lastIndexRef = useRef<number | null>(null)
  const rows = [...folders.map((folder) => ({ id: `folder:${folder.id}` })), ...assets.map((asset) => ({ id: asset.id }))]

  const handleRangeSelect = (index: number) => {
    const anchor = lastIndexRef.current
    lastIndexRef.current = index
    if (anchor === null) return
    const [start, end] = anchor < index ? [anchor, index] : [index, anchor]
    onSelectionReplace(rows.slice(start, end + 1).map((row) => row.id))
  }

  const toggleSort = (field: SortField) => onSortChange(field, sortField === field && sortDir === 'asc' ? 'desc' : 'asc')

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <CaretUp size={12} aria-hidden="true" /> : <CaretDown size={12} aria-hidden="true" />
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={rows.length > 0 && selectedIds.size === rows.length} onCheckedChange={() => onSelectionReplace(rows.map((row) => row.id))} aria-label="Select all items" />
            </TableHead>
            <TableHead>Preview</TableHead>
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('name')}>Name {renderSortIcon('name')}</button>
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('type')}>Type {renderSortIcon('type')}</button>
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('size')}>Size {renderSortIcon('size')}</button>
            </TableHead>
            <TableHead className="hidden md:table-cell">Artist</TableHead>
            <TableHead className="hidden md:table-cell">
              <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('date')}>Date {renderSortIcon('date')}</button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder, index) => (
            <TableRow key={folder.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(`folder:${folder.id}`)}
                  onCheckedChange={() => onFolderSelect(folder.id, true)}
                  aria-label={`Select folder ${folder.name}`}
                />
              </TableCell>
              <TableCell colSpan={6}>
                <div onClick={(event) => {
                  if (event.shiftKey) handleRangeSelect(index)
                  else lastIndexRef.current = index
                }}>
                  <FolderItem
                    folder={folder}
                    folders={allFolders}
                    artists={artists}
                    viewMode="list"
                    selected={selectedIds.has(`folder:${folder.id}`)}
                    renaming={renaming?.type === 'folder' && renaming.id === folder.id}
                    onNavigate={onFolderNavigate}
                    onSelect={(multi) => onFolderSelect(folder.id, multi)}
                    onRename={() => onFolderRenameStart(folder.id)}
                    onRenameCommit={(name) => onFolderRenameCommit(folder.id, name)}
                    onDelete={() => onFolderDelete(folder.id)}
                    onCreateSubfolder={() => onFolderCreate(folder.id)}
                    onMoveToFolder={(folderId) => onFolderMove(folder.id, folderId)}
                    onFilesDropped={onFolderFilesDropped}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {assets.map((asset, assetIndex) => {
            const index = folders.length + assetIndex
            return (
              <TableRow key={asset.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(asset.id)}
                    onCheckedChange={() => onAssetSelect(asset.id, true)}
                    aria-label={`Select file ${asset.originalFilename}`}
                  />
                </TableCell>
                <TableCell colSpan={6}>
                  <div onClick={(event) => {
                    if (event.shiftKey) handleRangeSelect(index)
                    else lastIndexRef.current = index
                  }}>
                    <FileItem
                      asset={asset}
                      artists={artists}
                     releases={releases}
                     folders={allFolders}
                     artistName={asset.artistId ? artistNames[asset.artistId] : undefined}
                     viewMode="list"
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
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollArea>
    </div>
  )
}

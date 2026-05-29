import type { Asset, AssetFolder } from '@/types'

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
}

export function isImageAsset(asset: Asset): boolean {
  return asset.mimeType.startsWith('image/')
}

export function isAudioAsset(asset: Asset): boolean {
  return asset.mimeType.startsWith('audio/')
}

export function getFolderPathLabel(folderId: string | null, folders: AssetFolder[]): string {
  if (!folderId) return 'Root'
  const parts: string[] = []
  let currentId: string | null = folderId
  while (currentId) {
    const folder = folders.find((item) => item.id === currentId)
    if (!folder) break
    parts.unshift(folder.name)
    currentId = folder.parentId
  }
  return parts.join(' / ') || 'Root'
}

export function buildFolderTree(folders: AssetFolder[], parentId: string | null = null): AssetFolder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => ({
      ...folder,
      children: buildFolderTree(folders, folder.id),
    }))
}

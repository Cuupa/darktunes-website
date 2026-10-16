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

/** Search > folder > artist. A selected folder must list that folder, not artist_id. */
export function buildAssetPickerQuery(options: {
  search: string
  folderId: string | null
  artistId?: string
}): URLSearchParams {
  const params = new URLSearchParams()
  const search = options.search.trim()
  if (search) {
    params.set('search', search)
  } else if (options.folderId) {
    params.set('folderId', options.folderId)
  } else if (options.artistId) {
    params.set('artistId', options.artistId)
  }
  return params
}

export function findArtistPickerFolder(
  folders: AssetFolder[],
  artistId: string,
): AssetFolder | undefined {
  const owned = folders.filter((folder) => folder.artistId === artistId)
  return owned.find((folder) => folder.name.toLowerCase() !== 'collabs') ?? owned[0]
}

export function folderAncestorIds(folders: AssetFolder[], folderId: string): string[] {
  const ids: string[] = []
  let current = folders.find((folder) => folder.id === folderId)
  while (current) {
    ids.push(current.id)
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) : undefined
  }
  return ids
}

import { describe, expect, it } from 'vitest'
import type { AssetFolder } from '@/types'
import { buildAssetPickerQuery, findArtistPickerFolder, folderAncestorIds } from './utils'

function folder(overrides: Partial<AssetFolder>): AssetFolder {
  return {
    id: 'id',
    name: 'name',
    parentId: null,
    artistId: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('buildAssetPickerQuery', () => {
  it('prefers search over folder and artist', () => {
    const params = buildAssetPickerQuery({
      search: '  omni  ',
      folderId: 'folder-1',
      artistId: 'artist-1',
    })
    expect(params.get('search')).toBe('omni')
    expect(params.get('folderId')).toBeNull()
    expect(params.get('artistId')).toBeNull()
  })

  it('lists the selected folder even when artistId is set', () => {
    const params = buildAssetPickerQuery({
      search: '',
      folderId: 'folder-1',
      artistId: 'artist-1',
    })
    expect(params.get('folderId')).toBe('folder-1')
    expect(params.get('artistId')).toBeNull()
  })

  it('falls back to artist when no folder is selected', () => {
    const params = buildAssetPickerQuery({
      search: '',
      folderId: null,
      artistId: 'artist-1',
    })
    expect(params.get('artistId')).toBe('artist-1')
    expect(params.get('folderId')).toBeNull()
  })

  it('sends no params for root with no artist', () => {
    const params = buildAssetPickerQuery({ search: '  ', folderId: null })
    expect([...params.keys()]).toEqual([])
  })
})

describe('findArtistPickerFolder', () => {
  const artistsRoot = folder({ id: 'artists', name: 'artists' })
  const omnimar = folder({
    id: 'omnimar',
    name: 'Omnimar',
    parentId: 'artists',
    artistId: 'artist-1',
  })
  const collabs = folder({
    id: 'collabs',
    name: 'collabs',
    parentId: 'omnimar',
    artistId: 'artist-1',
  })

  it('returns the nested artist folder, not collabs', () => {
    expect(findArtistPickerFolder([artistsRoot, collabs, omnimar], 'artist-1')?.id).toBe('omnimar')
  })

  it('returns undefined when the artist has no folder', () => {
    expect(findArtistPickerFolder([artistsRoot], 'artist-1')).toBeUndefined()
  })
})

describe('folderAncestorIds', () => {
  it('walks parent ids from the folder up', () => {
    const folders = [
      folder({ id: 'artists', name: 'artists' }),
      folder({ id: 'omnimar', name: 'Omnimar', parentId: 'artists', artistId: 'artist-1' }),
    ]
    expect(folderAncestorIds(folders, 'omnimar')).toEqual(['omnimar', 'artists'])
  })
})

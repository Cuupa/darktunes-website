/**
 * src/lib/epk/pickerAssets.ts
 *
 * Merges artist photos from uploads, label assets, profile, and EPK gallery
 * for the EPK builder asset picker.
 */

import type { Artist, ArtistAsset, Asset } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'

export type EpkPickerAssetSource = 'upload' | 'label' | 'profile' | 'gallery' | 'logo'

export interface EpkPickerAsset {
  id: string
  publicUrl: string
  originalFilename: string
  mimeType: string
  source: EpkPickerAssetSource
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function virtualAsset(
  id: string,
  url: string,
  label: string,
  source: EpkPickerAssetSource,
): EpkPickerAsset {
  return {
    id,
    publicUrl: url,
    originalFilename: label,
    mimeType: 'image/jpeg',
    source,
  }
}

export function buildEpkPickerAssets(input: {
  artist: Artist
  artistProfile: ArtistProfile | null
  artistAssets: ArtistAsset[]
  labelAssets?: Asset[]
}): EpkPickerAsset[] {
  const { artist, artistProfile, artistAssets, labelAssets = [] } = input
  const seen = new Set<string>()
  const result: EpkPickerAsset[] = []

  const push = (asset: EpkPickerAsset) => {
    if (!asset.publicUrl || seen.has(asset.publicUrl)) return
    seen.add(asset.publicUrl)
    result.push(asset)
  }

  for (const asset of artistAssets) {
    if (!isImageMime(asset.mimeType)) continue
    push({
      id: asset.id,
      publicUrl: asset.publicUrl,
      originalFilename: asset.originalFilename || asset.filename,
      mimeType: asset.mimeType,
      source: 'upload',
    })
  }

  for (const asset of labelAssets) {
    if (!isImageMime(asset.mimeType)) continue
    push({
      id: `label-${asset.id}`,
      publicUrl: asset.publicUrl,
      originalFilename: asset.originalFilename || asset.filename,
      mimeType: asset.mimeType,
      source: 'label',
    })
  }

  if (artist.imageUrl) {
    push(virtualAsset('profile-photo', artist.imageUrl, 'Profile photo', 'profile'))
  }

  if (artist.logoUrl) {
    push(virtualAsset('artist-logo', artist.logoUrl, 'Artist logo', 'logo'))
  }

  for (const [index, url] of (artistProfile?.epkGalleryPhotos ?? []).entries()) {
    if (!url) continue
    push(virtualAsset(`gallery-${index}`, url, `Gallery photo ${index + 1}`, 'gallery'))
  }

  if (artistProfile?.epkBgImageUrl) {
    push(virtualAsset('epk-bg', artistProfile.epkBgImageUrl, 'EPK background', 'gallery'))
  }

  return result
}
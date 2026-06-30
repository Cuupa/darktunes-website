/**
 * src/lib/api/portalGalleryPress.ts
 *
 * Bridges portal profile gallery photos (artist_epks.epk_gallery_photos) with the
 * press kit (assets + press_kit_items) so journalist downloads stay in sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PressAsset } from '@/types'
import type { Database } from '@/types/database'
import { createAssetRecord, updateAsset } from './assets'
import { addToPressKit, bulkRemoveFromPressKitByAssetIds } from './pressKit'

type DbClient = SupabaseClient<Database>

export const PORTAL_GALLERY_TAG = 'portal_gallery'

function mimeTypeFromGalleryUrl(url: string): string {
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function filenameFromGalleryUrl(url: string): string {
  const segment = url.split('?')[0].split('/').pop() ?? 'gallery-photo'
  return decodeURIComponent(segment)
}

function r2KeyFromPublicUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return `profile-photos/unknown/${filenameFromGalleryUrl(url)}`
  }
}

/** Virtual press asset for a portal gallery URL not yet in press_kit_items. */
export function galleryUrlToPressAsset(url: string, artistId: string, displayOrder: number): PressAsset {
  const filename = filenameFromGalleryUrl(url)
  return {
    id: `portal-gallery:${artistId}:${displayOrder}`,
    filename,
    originalFilename: filename,
    mimeType: mimeTypeFromGalleryUrl(url),
    sizeBytes: 0,
    r2Key: r2KeyFromPublicUrl(url),
    publicUrl: url,
    createdAt: new Date(0).toISOString(),
    artistId,
    artistIds: [artistId],
    tags: [PORTAL_GALLERY_TAG],
    isPressApproved: true,
    pressSuggested: false,
    pressCategory: 'photo',
    downloadableForPress: true,
    kitItemId: `portal-gallery:${artistId}:${displayOrder}`,
    kitDisplayOrder: displayOrder,
    kitArtistId: artistId,
  }
}

/** Append portal gallery URLs that are not already present in the curated kit. */
export function mergePortalGalleryPhotos(
  kitPhotos: PressAsset[],
  galleryUrls: string[],
  artistId: string,
): PressAsset[] {
  const seen = new Set(kitPhotos.map((photo) => photo.publicUrl))
  const merged = [...kitPhotos]
  let order =
    merged.length > 0 ? Math.max(...merged.map((photo) => photo.kitDisplayOrder)) + 1 : 0

  for (const url of galleryUrls) {
    if (!url || seen.has(url)) continue
    merged.push(galleryUrlToPressAsset(url, artistId, order))
    order += 1
    seen.add(url)
  }

  return merged.sort((a, b) => a.kitDisplayOrder - b.kitDisplayOrder)
}

/**
 * Ensures each portal gallery URL has a press-approved asset in the artist-scoped
 * press kit. Uses a service-role client — portal artists cannot insert into assets.
 */
export async function syncPortalGalleryToPressKit(
  db: DbClient,
  artistId: string,
  galleryUrls: string[],
  uploadedBy?: string,
): Promise<void> {
  const desiredUrls = [...new Set(galleryUrls.filter(Boolean))]
  if (desiredUrls.length === 0) {
    const { data: staleAssets, error: staleError } = await db
      .from('assets')
      .select('id')
      .eq('artist_id', artistId)
      .contains('tags', [PORTAL_GALLERY_TAG])

    if (staleError) throw new Error(staleError.message)

    const staleIds = (staleAssets ?? []).map((row) => row.id)
    if (staleIds.length > 0) {
      await bulkRemoveFromPressKitByAssetIds(db, staleIds, artistId)
    }
    return
  }

  const { data: existingAssets, error } = await db
    .from('assets')
    .select('id, public_url, tags')
    .eq('artist_id', artistId)
    .in('public_url', desiredUrls)

  if (error) throw new Error(error.message)

  const assetIdByUrl = new Map((existingAssets ?? []).map((row) => [row.public_url, row.id]))

  for (const url of desiredUrls) {
    let assetId = assetIdByUrl.get(url)

    if (!assetId) {
      const filename = filenameFromGalleryUrl(url)
      const asset = await createAssetRecord(db, {
        filename,
        original_filename: filename,
        mime_type: mimeTypeFromGalleryUrl(url),
        size_bytes: 0,
        r2_key: r2KeyFromPublicUrl(url),
        public_url: url,
        artist_id: artistId,
        uploaded_by: uploadedBy ?? null,
        is_press_approved: true,
        downloadable_for_press: true,
        press_category: 'photo',
        tags: [PORTAL_GALLERY_TAG],
      })
      assetId = asset.id
      assetIdByUrl.set(url, assetId)
    } else {
      await updateAsset(db, assetId, {
        isPressApproved: true,
        downloadableForPress: true,
        pressCategory: 'photo',
        tags: [PORTAL_GALLERY_TAG],
      })
    }

    try {
      await addToPressKit(db, { assetId, artistId })
    } catch (syncErr) {
      const message = syncErr instanceof Error ? syncErr.message : String(syncErr)
      if (!message.includes('duplicate') && !message.includes('unique')) throw syncErr
    }
  }

  const { data: managedAssets, error: managedError } = await db
    .from('assets')
    .select('id, public_url')
    .eq('artist_id', artistId)
    .contains('tags', [PORTAL_GALLERY_TAG])

  if (managedError) throw new Error(managedError.message)

  const desiredSet = new Set(desiredUrls)
  const staleIds = (managedAssets ?? [])
    .filter((row) => !desiredSet.has(row.public_url))
    .map((row) => row.id)

  if (staleIds.length > 0) {
    await bulkRemoveFromPressKitByAssetIds(db, staleIds, artistId)
  }
}
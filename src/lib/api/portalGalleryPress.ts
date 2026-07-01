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

/** R2 object key derived from a public CDN URL (used for asset deduplication). */
export function r2KeyFromPublicUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return `profile-photos/unknown/${filenameFromGalleryUrl(url)}`
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
    return true
  }
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('duplicate') || message.includes('unique')
}

async function resolveUploadedBy(db: DbClient, userId?: string): Promise<string | null> {
  if (!userId) return null
  const { data, error } = await db.from('users').select('id').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

type ExistingAssetRow = { id: string; public_url: string; r2_key: string }

/** Map each gallery URL to an existing asset id (match by public_url or r2_key). */
function buildAssetIdByUrl(
  desiredUrls: string[],
  rows: ExistingAssetRow[],
): Map<string, string> {
  const byPublicUrl = new Map(rows.map((row) => [row.public_url, row.id]))
  const byR2Key = new Map(rows.map((row) => [row.r2_key, row.id]))
  const result = new Map<string, string>()

  for (const url of desiredUrls) {
    const byUrl = byPublicUrl.get(url)
    if (byUrl) {
      result.set(url, byUrl)
      continue
    }
    const byKey = byR2Key.get(r2KeyFromPublicUrl(url))
    if (byKey) result.set(url, byKey)
  }

  return result
}

async function loadExistingGalleryAssets(
  db: DbClient,
  artistId: string,
  desiredUrls: string[],
): Promise<ExistingAssetRow[]> {
  const r2Keys = [...new Set(desiredUrls.map(r2KeyFromPublicUrl))]
  const seen = new Map<string, ExistingAssetRow>()

  const { data: byUrl, error: urlError } = await db
    .from('assets')
    .select('id, public_url, r2_key')
    .eq('artist_id', artistId)
    .in('public_url', desiredUrls)

  if (urlError) throw new Error(urlError.message)
  for (const row of byUrl ?? []) {
    seen.set(row.id, row)
  }

  const { data: byKey, error: keyError } = await db
    .from('assets')
    .select('id, public_url, r2_key')
    .in('r2_key', r2Keys)

  if (keyError) throw new Error(keyError.message)
  for (const row of byKey ?? []) {
    seen.set(row.id, row)
  }

  return [...seen.values()]
}

async function ensureGalleryAsset(
  db: DbClient,
  artistId: string,
  url: string,
  uploadedBy: string | null,
  knownAssetId?: string,
): Promise<string> {
  if (knownAssetId) {
    await updateAsset(db, knownAssetId, {
      isPressApproved: true,
      downloadableForPress: true,
      pressCategory: 'photo',
      tags: [PORTAL_GALLERY_TAG],
    })
    return knownAssetId
  }

  const filename = filenameFromGalleryUrl(url)
  const r2Key = r2KeyFromPublicUrl(url)

  try {
    const asset = await createAssetRecord(db, {
      filename,
      original_filename: filename,
      mime_type: mimeTypeFromGalleryUrl(url),
      size_bytes: 0,
      r2_key: r2Key,
      public_url: url,
      artist_id: artistId,
      uploaded_by: uploadedBy,
      is_press_approved: true,
      downloadable_for_press: true,
      press_category: 'photo',
      tags: [PORTAL_GALLERY_TAG],
    })
    return asset.id
  } catch (err) {
    if (!isUniqueViolation(err)) throw err

    const { data: existing, error } = await db
      .from('assets')
      .select('id')
      .eq('r2_key', r2Key)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!existing?.id) throw err

    await updateAsset(db, existing.id, {
      isPressApproved: true,
      downloadableForPress: true,
      pressCategory: 'photo',
      tags: [PORTAL_GALLERY_TAG],
    })
    return existing.id
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
  uploadedByUserId?: string,
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

  const existingRows = await loadExistingGalleryAssets(db, artistId, desiredUrls)
  const assetIdByUrl = buildAssetIdByUrl(desiredUrls, existingRows)
  const resolvedUploadedBy = await resolveUploadedBy(db, uploadedByUserId)

  for (const url of desiredUrls) {
    const assetId = await ensureGalleryAsset(
      db,
      artistId,
      url,
      resolvedUploadedBy,
      assetIdByUrl.get(url),
    )
    assetIdByUrl.set(url, assetId)

    try {
      await addToPressKit(db, { assetId, artistId })
    } catch (syncErr) {
      if (!isUniqueViolation(syncErr)) throw syncErr
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
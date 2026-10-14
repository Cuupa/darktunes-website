/**
 * Decides whether a journalist may receive a file.
 * The caller string is only a lookup key. The signed value is always the stored one.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { logDownload } from '@/lib/api/journalistDownloads'
import { isPromoEmbargoActive } from '@/lib/api/promoTracks'
import { verifyPromoNdaToken } from '@/lib/press/promoNdaToken'

type Db = SupabaseClient<Database>

export type PressDownloadIntent = 'stream' | 'download'

export interface PressObjectGrant {
  /** Value stored in the database. Never the raw caller string. */
  stored: string
  /** False when `stored` is already an http(s) URL. */
  sign: boolean
  assetId: string | null
  releaseId: string | null
  /** True when an NDA download was logged before a URL may be minted. */
  alreadyLogged: boolean
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function grantFor(stored: string, ids: { assetId?: string | null; releaseId?: string | null; alreadyLogged?: boolean }): PressObjectGrant {
  return {
    stored,
    sign: !isHttpUrl(stored),
    assetId: ids.assetId ?? null,
    releaseId: ids.releaseId ?? null,
    alreadyLogged: ids.alreadyLogged ?? false,
  }
}

export async function authorizePressObject(
  db: Db,
  callerKey: string,
  opts: {
    intent: PressDownloadIntent
    journalistId: string
    nowMs?: number
    ndaToken?: string
    ndaSecret?: string
    releaseId?: string | null
  },
): Promise<PressObjectGrant | null> {
  const key = callerKey.trim()
  if (!key) return null
  const nowMs = opts.nowMs ?? Date.now()

  const track = await db
    .from('promo_tracks')
    .select('r2_key, embargo_until, nda_required')
    .eq('r2_key', key)
    .maybeSingle()
  if (track.error) return null
  if (track.data) {
    if (isPromoEmbargoActive(track.data.embargo_until, nowMs)) return null
    if (opts.intent === 'download' && track.data.nda_required === true) {
      if (
        !opts.ndaSecret ||
        !opts.ndaToken ||
        !verifyPromoNdaToken(opts.ndaSecret, opts.ndaToken, opts.journalistId, key, nowMs)
      ) {
        return null
      }
      return grantFor(track.data.r2_key, {})
    }
    return grantFor(track.data.r2_key, {})
  }

  const asset = await db
    .from('assets')
    .select('id, r2_key')
    .eq('r2_key', key)
    .eq('is_press_approved', true)
    .eq('downloadable_for_press', true)
    .maybeSingle()
  if (asset.error) return null
  if (asset.data) return grantFor(asset.data.r2_key, { assetId: asset.data.id })

  const byUrl = await db
    .from('assets')
    .select('id, r2_key, public_url')
    .eq('public_url', key)
    .eq('is_press_approved', true)
    .eq('downloadable_for_press', true)
    .limit(1)
  if (byUrl.error) return null
  const urlRow = byUrl.data?.[0]
  if (urlRow) {
    const stored = urlRow.r2_key || urlRow.public_url
    return grantFor(stored, { assetId: urlRow.id })
  }

  if (opts.releaseId) {
    const owned = await db
      .from('releases')
      .select('id, preview_url, cover_art')
      .eq('id', opts.releaseId)
      .eq('is_promo', true)
      .maybeSingle()
    if (owned.error || !owned.data) return null
    if (owned.data.preview_url === key) {
      return grantFor(owned.data.preview_url, { releaseId: owned.data.id })
    }
    if (owned.data.cover_art === key) {
      return grantFor(owned.data.cover_art, { releaseId: owned.data.id })
    }
    return null
  }

  const byPreview = await db
    .from('releases')
    .select('id, preview_url')
    .eq('is_promo', true)
    .eq('preview_url', key)
    .limit(1)
  if (byPreview.error) return null
  const previewRow = byPreview.data?.[0]
  if (previewRow?.preview_url) {
    return grantFor(previewRow.preview_url, { releaseId: previewRow.id })
  }

  const byCover = await db
    .from('releases')
    .select('id, cover_art')
    .eq('is_promo', true)
    .eq('cover_art', key)
    .limit(1)
  if (byCover.error) return null
  const coverRow = byCover.data?.[0]
  if (coverRow?.cover_art) {
    return grantFor(coverRow.cover_art, { releaseId: coverRow.id })
  }

  return null
}

/** Writes the acceptance row. Download is allowed only after this row exists. */
export async function recordPromoNdaAcceptance(
  db: Db,
  callerKey: string,
  journalistId: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const key = callerKey.trim()
  if (!key) return false
  const track = await db
    .from('promo_tracks')
    .select('r2_key, embargo_until, nda_required')
    .eq('r2_key', key)
    .maybeSingle()
  if (track.error || !track.data || track.data.nda_required !== true) return false
  if (isPromoEmbargoActive(track.data.embargo_until, nowMs)) return false
  const prior = await db
    .from('journalist_downloads')
    .select('id')
    .eq('journalist_id', journalistId)
    .eq('asset_key', track.data.r2_key)
    .limit(1)
  if (prior.error) return false
  if (prior.data?.length) return true
  try {
    await logDownload(db, {
      journalist_id: journalistId,
      asset_key: track.data.r2_key,
      release_id: null,
    })
    return true
  } catch {
    return false
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getFeatureToggles } from '@/lib/featureToggles'

type DbClient = SupabaseClient<Database>

/** Global site toggle — single source of truth for promo pool availability. */
export async function isPromoPoolEnabled(db: DbClient): Promise<boolean> {
  const toggles = await getFeatureToggles(db).catch(() => null)
  return toggles?.promoPool ?? true
}

export async function isPressApplicationsEnabled(db: DbClient): Promise<boolean> {
  const flags = await getFeatureFlagsForRole(db, 'journalist').catch(() => ({} as Record<string, boolean>))
  return flags['press.applications'] !== false
}

export async function isPressZipDownloadEnabled(db: DbClient): Promise<boolean> {
  const flags = await getFeatureFlagsForRole(db, 'journalist').catch(() => ({} as Record<string, boolean>))
  return flags['press.zip_download'] !== false
}

export async function isPressAudioPreviewEnabled(db: DbClient): Promise<boolean> {
  const flags = await getFeatureFlagsForRole(db, 'journalist').catch(() => ({} as Record<string, boolean>))
  return flags['press.audio_preview'] !== false
}

/** Replaced by global `promoPool` toggle — hidden from admin UI, ignored at runtime. */
export const DEPRECATED_PORTAL_FEATURE_FLAGS = new Set(['press.promo_tracks'])
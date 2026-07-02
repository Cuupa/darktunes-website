import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SiteSettings } from '@/types'
import { getSiteSettings, SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { deriveShortName } from '@/lib/brand/deriveShortName'

type DbClient = SupabaseClient<Database>

export type BrandContext = {
  labelName: string
  labelShortName: string
  contactEmail: string
  siteUrl: string
}

export { deriveShortName } from '@/lib/brand/deriveShortName'
export {
  readTenantBootstrap,
  NEUTRAL_LABEL_NAME,
  NEUTRAL_CONTACT_EMAIL,
} from '@/lib/brand/tenantDefaults'

export function resolveSiteUrl(siteUrl?: string): string {
  const raw = siteUrl?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || ''
  return raw.replace(/\/$/, '')
}

export function resolveBrandFromSettings(
  settings: SiteSettings,
  siteUrl?: string,
): BrandContext {
  const labelShortName =
    settings.labelShortName?.trim() || deriveShortName(settings.labelName)

  return {
    labelName: settings.labelName,
    labelShortName,
    contactEmail: settings.contactEmail,
    siteUrl: resolveSiteUrl(siteUrl),
  }
}

export async function getBrandContext(db?: DbClient): Promise<BrandContext> {
  const settings = db
    ? await getSiteSettings(db)
    : (await getCachedSiteSettings().catch(() => null)) ?? SITE_SETTINGS_DEFAULTS
  return resolveBrandFromSettings(settings)
}
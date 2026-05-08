import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SiteSettings } from '@/types'

type DbClient = SupabaseClient<Database>

/** Default values used when a key is missing from the database. */
const DEFAULTS: SiteSettings = {
  labelName: 'darkTunes Music Group',
  labelTagline: "We don't follow trends—we create them.",
  contactEmail: 'info@darktunes.com',
  privacyPolicyUrl: 'https://darktunes.com/privacy',
  termsUrl: 'https://darktunes.com/terms',
  instagramUrl: 'https://instagram.com/darktunes',
  youtubeUrl: 'https://youtube.com/@darktunes',
  spotifyUrl: 'https://open.spotify.com/user/darktunes',
  spotifyPlaylistUri: '37i9dQZF1DWWqNV5cS50j6',
  heroBadge: '⚡ New Release',
  heroDescription:
    'Experience the latest evolution in alternative music. A sonic journey that pushes boundaries and defies expectations.',
  seoTitle: 'darkTunes Music Group',
  seoDescription:
    'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.',
  ogTitle: 'darkTunes Music Group',
  ogDescription: 'Alternative music label — artists, releases, news, and videos.',
}

/** Maps flat DB key-value rows into the typed SiteSettings domain object. */
function rowsToSettings(rows: { key: string; value: string }[]): SiteSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    labelName: map['label_name'] ?? DEFAULTS.labelName,
    labelTagline: map['label_tagline'] ?? DEFAULTS.labelTagline,
    contactEmail: map['contact_email'] ?? DEFAULTS.contactEmail,
    privacyPolicyUrl: map['privacy_policy_url'] ?? DEFAULTS.privacyPolicyUrl,
    termsUrl: map['terms_url'] ?? DEFAULTS.termsUrl,
    instagramUrl: map['instagram_url'] ?? DEFAULTS.instagramUrl,
    youtubeUrl: map['youtube_url'] ?? DEFAULTS.youtubeUrl,
    spotifyUrl: map['spotify_url'] ?? DEFAULTS.spotifyUrl,
    spotifyPlaylistUri: map['spotify_playlist_uri'] ?? DEFAULTS.spotifyPlaylistUri,
    heroBadge: map['hero_badge'] ?? DEFAULTS.heroBadge,
    heroDescription: map['hero_description'] ?? DEFAULTS.heroDescription,
    seoTitle: map['seo_title'] ?? DEFAULTS.seoTitle,
    seoDescription: map['seo_description'] ?? DEFAULTS.seoDescription,
    ogTitle: map['og_title'] ?? DEFAULTS.ogTitle,
    ogDescription: map['og_description'] ?? DEFAULTS.ogDescription,
  }
}

/**
 * Fetch all site settings rows and return a typed SiteSettings object.
 * Missing keys fall back to hardcoded defaults so the site never breaks.
 */
export async function getSiteSettings(db: DbClient): Promise<SiteSettings> {
  const { data, error } = await db.from('site_settings').select('key, value')
  if (error) throw new Error(error.message)
  return rowsToSettings(data ?? [])
}

/**
 * Upsert a single site-setting key-value pair.
 * Used by the Admin CMS when saving individual settings.
 */
export async function upsertSiteSetting(
  db: DbClient,
  key: string,
  value: string,
): Promise<void> {
  const { error } = await db
    .from('site_settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/**
 * Upsert multiple site-setting key-value pairs at once.
 * Used by the Admin CMS when saving a whole settings section.
 */
export async function upsertSiteSettings(
  db: DbClient,
  settings: Partial<Record<string, string>>,
): Promise<void> {
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value: value ?? '' }))
  if (rows.length === 0) return
  const { error } = await db.from('site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

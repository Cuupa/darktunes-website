import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SECTION_ORDER } from '@/config/sections'
import type { Database } from '@/types/database'
import type { SiteSettings, SpotifyPlaylistEntry, FeatureToggles, RolePermissions, HomepageSection } from '@/types'

type DbClient = SupabaseClient<Database>

/** Default feature toggle values — all features enabled by default. */
const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  promoPool: true,
  editorTools: true,
}

/** Default permission sets per role. Admin has all permissions; others are restricted. */
const DEFAULT_ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  admin: { canPublishNews: true, canEditNews: true, canManageArtists: true, canManageReleases: true, canManageVideos: true, canViewAdminPanel: true },
  editor: { canPublishNews: true, canEditNews: true, canManageArtists: false, canManageReleases: true, canManageVideos: true, canViewAdminPanel: true },
  journalist: { canPublishNews: false, canEditNews: false, canManageArtists: false, canManageReleases: false, canManageVideos: false, canViewAdminPanel: false },
  artist: { canPublishNews: false, canEditNews: false, canManageArtists: false, canManageReleases: false, canManageVideos: false, canViewAdminPanel: false },
  user: { canPublishNews: false, canEditNews: false, canManageArtists: false, canManageReleases: false, canManageVideos: false, canViewAdminPanel: false },
}

/** Default values used when a key is missing from the database. */
const DEFAULTS: SiteSettings = {
  labelName: 'darkTunes Music Group',
  labelTagline: "We don't follow trends—we create them.",
  contactEmail: 'info@darktunes.com',
  privacyPolicyUrl: '/datenschutz',
  termsUrl: '/impressum',
  instagramUrl: 'https://instagram.com/darktunes',
  youtubeUrl: 'https://youtube.com/@darktunes',
  spotifyUrl: 'https://open.spotify.com/user/darktunes',
  spotifyPlaylistUri: '37i9dQZF1DWWqNV5cS50j6',
  spotifyPlaylists: [],
  heroBadge: '⚡ New Release',
  heroDescription:
    'Experience the latest evolution in alternative music. A sonic journey that pushes boundaries and defies expectations.',
  seoTitle: 'darkTunes Music Group',
  seoDescription:
    'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.',
  ogTitle: 'darkTunes Music Group',
  ogDescription: 'Alternative music label — artists, releases, news, and videos.',
  impressumCompanyName: 'darkTunes Music Group',
  impressumLegalForm: '',
  impressumRepresentative: '',
  impressumAddress: '',
  impressumVatId: '',
  impressumRegisterCourt: '',
  impressumRegisterNumber: '',
  impressumPhone: '',
  impressumEmail: 'info@darktunes.com',
  datenschutzContent: '',
  consentPlaceholderUrl: '',
  noiseOpacity: 0.04,
  crtScanlinesEnabled: true,
  vignetteIntensity: 0.5,
  shopifyStoreUrl: '',
  youtubeChannelId: '',
  videosPerPage: 9,
  videosLinkToPage: false,
  carouselAutoplayMs: 0,
  featureToggles: DEFAULT_FEATURE_TOGGLES,
  logoUrl: '',
  faviconUrl: '',
  aboutHeadline: '',
  aboutSubheading: '',
  aboutBody: '',
  newsletterHeading: '',
  newsletterDescription: '',
  spotifySectionHeading: '',
  spotifySectionSubheading: '',
  videosSectionHeading: '',
  videosSectionSubheading: '',
  newsSectionHeading: '',
  newsSectionSubheading: '',
  concertsSectionHeading: '',
  concertsSectionSubheading: '',
  releasesSectionHeading: '',
  releasesSectionSubheading: '',
  heroContentType: 'release',
  heroFeaturedId: '',
  heroCustomBgUrl: '',
  homepageSectionOrder: DEFAULT_SECTION_ORDER,
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
}

/** Maps flat DB key-value rows into the typed SiteSettings domain object. */
function rowsToSettings(rows: { key: string; value: string }[]): SiteSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  let spotifyPlaylists: SpotifyPlaylistEntry[] = []

  try {
    const parsed = JSON.parse(map['spotify_playlists'] ?? '[]') as unknown
    if (Array.isArray(parsed)) {
      // Keep this runtime guard aligned with the admin Zod schema in SiteSettingsManager.tsx.
      spotifyPlaylists = parsed.filter((entry): entry is SpotifyPlaylistEntry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
        const candidate = entry as { label?: unknown; uri?: unknown; theme?: unknown; accentColor?: unknown }
        return typeof candidate.label === 'string' && typeof candidate.uri === 'string'
      }).map((entry) => {
        const e = entry as { label: string; uri: string; theme?: unknown; accentColor?: unknown }
        return {
          label: e.label,
          uri: e.uri,
          theme: (e.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light',
          accentColor: typeof e.accentColor === 'string' ? e.accentColor : '',
        }
      })
    }
  } catch {
    spotifyPlaylists = []
  }

  let featureToggles: FeatureToggles = { ...DEFAULT_FEATURE_TOGGLES }
  try {
    const parsed = JSON.parse(map['feature_toggles'] ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const candidate = parsed as Record<string, unknown>
      featureToggles = {
        promoPool: typeof candidate['promoPool'] === 'boolean' ? candidate['promoPool'] : DEFAULT_FEATURE_TOGGLES.promoPool,
        editorTools: typeof candidate['editorTools'] === 'boolean' ? candidate['editorTools'] : DEFAULT_FEATURE_TOGGLES.editorTools,
      }
    }
  } catch {
    featureToggles = { ...DEFAULT_FEATURE_TOGGLES }
  }

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
    spotifyPlaylists,
    heroBadge: map['hero_badge'] ?? DEFAULTS.heroBadge,
    heroDescription: map['hero_description'] ?? DEFAULTS.heroDescription,
    seoTitle: map['seo_title'] ?? DEFAULTS.seoTitle,
    seoDescription: map['seo_description'] ?? DEFAULTS.seoDescription,
    ogTitle: map['og_title'] ?? DEFAULTS.ogTitle,
    ogDescription: map['og_description'] ?? DEFAULTS.ogDescription,
    impressumCompanyName: map['impressum_company_name'] ?? DEFAULTS.impressumCompanyName,
    impressumLegalForm: map['impressum_legal_form'] ?? DEFAULTS.impressumLegalForm,
    impressumRepresentative: map['impressum_representative'] ?? DEFAULTS.impressumRepresentative,
    impressumAddress: map['impressum_address'] ?? DEFAULTS.impressumAddress,
    impressumVatId: map['impressum_vat_id'] ?? DEFAULTS.impressumVatId,
    impressumRegisterCourt: map['impressum_register_court'] ?? DEFAULTS.impressumRegisterCourt,
    impressumRegisterNumber: map['impressum_register_number'] ?? DEFAULTS.impressumRegisterNumber,
    impressumPhone: map['impressum_phone'] ?? DEFAULTS.impressumPhone,
    impressumEmail: map['impressum_email'] ?? DEFAULTS.impressumEmail,
    datenschutzContent: map['datenschutz_content'] ?? DEFAULTS.datenschutzContent,
    consentPlaceholderUrl: map['consent_placeholder_url'] ?? DEFAULTS.consentPlaceholderUrl,
    noiseOpacity: parseFloat(map['noise_opacity'] ?? '') || DEFAULTS.noiseOpacity,
    crtScanlinesEnabled:
      map['crt_scanlines_enabled'] !== undefined
        ? map['crt_scanlines_enabled'] === 'true'
        : DEFAULTS.crtScanlinesEnabled,
    vignetteIntensity: parseFloat(map['vignette_intensity'] ?? '') || DEFAULTS.vignetteIntensity,
    shopifyStoreUrl: map['shopify_store_url'] ?? DEFAULTS.shopifyStoreUrl,
    youtubeChannelId: map['youtube_channel_id'] ?? DEFAULTS.youtubeChannelId,
    videosPerPage: parseInt(map['videos_per_page'] ?? '') || DEFAULTS.videosPerPage,
    videosLinkToPage: map['videos_link_to_page'] === 'true',
    carouselAutoplayMs: parseInt(map['carousel_autoplay_ms'] ?? '0', 10) || 0,
    featureToggles,
    logoUrl: map['logo_url'] ?? '',
    faviconUrl: map['favicon_url'] ?? '',
    aboutHeadline: map['about_headline'] ?? '',
    aboutSubheading: map['about_subheading'] ?? '',
    aboutBody: map['about_body'] ?? '',
    newsletterHeading: map['newsletter_heading'] ?? '',
    newsletterDescription: map['newsletter_description'] ?? '',
    spotifySectionHeading: map['spotify_section_heading'] ?? '',
    spotifySectionSubheading: map['spotify_section_subheading'] ?? '',
    videosSectionHeading: map['videos_section_heading'] ?? '',
    videosSectionSubheading: map['videos_section_subheading'] ?? '',
    newsSectionHeading: map['news_section_heading'] ?? '',
    newsSectionSubheading: map['news_section_subheading'] ?? '',
    concertsSectionHeading: map['concerts_section_heading'] ?? '',
    concertsSectionSubheading: map['concerts_section_subheading'] ?? '',
    releasesSectionHeading: map['releases_section_heading'] ?? '',
    releasesSectionSubheading: map['releases_section_subheading'] ?? '',
    heroContentType: (map['hero_content_type'] === 'news' ? 'news' : 'release') as 'release' | 'news',
    heroFeaturedId: map['hero_featured_id'] ?? '',
    heroCustomBgUrl: map['hero_custom_bg_url'] ?? '',
    homepageSectionOrder: (() => {
      try {
        const parsed = JSON.parse(map['homepage_section_order'] ?? '[]') as unknown
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = (parsed as string[]).filter((s): s is HomepageSection => DEFAULT_SECTION_ORDER.includes(s as HomepageSection))
          if (filtered.length > 0) return filtered
        }
      } catch { /* ignore */ }
      return DEFAULT_SECTION_ORDER
    })(),
    rolePermissions: (() => {
      try {
        const parsed = JSON.parse(map['role_permissions'] ?? '{}') as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...DEFAULT_ROLE_PERMISSIONS, ...(parsed as Record<string, RolePermissions>) }
        }
      } catch { /* ignore */ }
      return DEFAULT_ROLE_PERMISSIONS
    })(),
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

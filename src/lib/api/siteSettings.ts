import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SECTION_ORDER } from '@/config/sections'
import type { Database } from '@/types/database'
import type { SiteSettings, SpotifyPlaylistEntry, FeatureToggles, HomepageSection, ContactTopicConfig, CustomSocialLink } from '@/types'
import { parseThemeConfig, themeConfigFromFlatFields } from '@/config/themeConfig'
import type { ThemeConfig } from '@/config/themeConfig'

type DbClient = SupabaseClient<Database>

/** Default feature toggle values — all features enabled by default. */
const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  promoPool: true,
  editorTools: true,
}

/** Default values used when a key is missing from the database. */
export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
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
  heroNewsBadge: '📰 News',
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
  concertsPerPage: 8,
  concertsLinkToPage: false,
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
  heroDefaultPrimaryBtnLabel: '',
  heroDefaultSecondaryBtnLabel: '',
  homepageSectionOrder: DEFAULT_SECTION_ORDER,
  homepageNewsCount: 3,
  contactTopics: [],
  customSocialLinks: [],
  submitHubUrl: '',
  submitHubLabel: '',
  submitHubDescription: '',
  submitHubSectionHeading: '',
  showAboutInHeader: true,
  showAboutInFooter: true,
  aboutNavLabel: 'About',
  themePrimary: '',
  themeSecondary: '',
  themeBackground: '',
  themeForeground: '',
  themeCard: '',
  themeMuted: '',
  themeAccent: '',
  themeBorder: '',
  themeGradientHeroFrom: '',
  themeGradientHeroTo: '',
  themeGradientHeroDir: '135deg',
  themeGradientAccentFrom: '',
  themeGradientAccentTo: '',
  themeGradientAccentDir: '135deg',
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

  let contactTopics: ContactTopicConfig[] = []
  try {
    const parsed = JSON.parse(map['contact_topics'] ?? '[]') as unknown
    if (Array.isArray(parsed)) {
      contactTopics = parsed.filter((entry): entry is ContactTopicConfig => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
        const c = entry as Record<string, unknown>
        return typeof c['value'] === 'string' && typeof c['label_de'] === 'string' && typeof c['label_en'] === 'string'
      })
    }
  } catch {
    contactTopics = []
  }

  return {
    labelName: map['label_name'] ?? SITE_SETTINGS_DEFAULTS.labelName,
    labelTagline: map['label_tagline'] ?? SITE_SETTINGS_DEFAULTS.labelTagline,
    contactEmail: map['contact_email'] ?? SITE_SETTINGS_DEFAULTS.contactEmail,
    privacyPolicyUrl: map['privacy_policy_url'] ?? SITE_SETTINGS_DEFAULTS.privacyPolicyUrl,
    termsUrl: map['terms_url'] ?? SITE_SETTINGS_DEFAULTS.termsUrl,
    instagramUrl: map['instagram_url'] ?? SITE_SETTINGS_DEFAULTS.instagramUrl,
    youtubeUrl: map['youtube_url'] ?? SITE_SETTINGS_DEFAULTS.youtubeUrl,
    spotifyUrl: map['spotify_url'] ?? SITE_SETTINGS_DEFAULTS.spotifyUrl,
    spotifyPlaylistUri: map['spotify_playlist_uri'] ?? SITE_SETTINGS_DEFAULTS.spotifyPlaylistUri,
    spotifyPlaylists,
    heroBadge: map['hero_badge'] ?? SITE_SETTINGS_DEFAULTS.heroBadge,
    heroNewsBadge: map['hero_news_badge'] ?? SITE_SETTINGS_DEFAULTS.heroNewsBadge,
    heroDescription: map['hero_description'] ?? SITE_SETTINGS_DEFAULTS.heroDescription,
    seoTitle: map['seo_title'] ?? SITE_SETTINGS_DEFAULTS.seoTitle,
    seoDescription: map['seo_description'] ?? SITE_SETTINGS_DEFAULTS.seoDescription,
    ogTitle: map['og_title'] ?? SITE_SETTINGS_DEFAULTS.ogTitle,
    ogDescription: map['og_description'] ?? SITE_SETTINGS_DEFAULTS.ogDescription,
    impressumCompanyName: map['impressum_company_name'] ?? SITE_SETTINGS_DEFAULTS.impressumCompanyName,
    impressumLegalForm: map['impressum_legal_form'] ?? SITE_SETTINGS_DEFAULTS.impressumLegalForm,
    impressumRepresentative: map['impressum_representative'] ?? SITE_SETTINGS_DEFAULTS.impressumRepresentative,
    impressumAddress: map['impressum_address'] ?? SITE_SETTINGS_DEFAULTS.impressumAddress,
    impressumVatId: map['impressum_vat_id'] ?? SITE_SETTINGS_DEFAULTS.impressumVatId,
    impressumRegisterCourt: map['impressum_register_court'] ?? SITE_SETTINGS_DEFAULTS.impressumRegisterCourt,
    impressumRegisterNumber: map['impressum_register_number'] ?? SITE_SETTINGS_DEFAULTS.impressumRegisterNumber,
    impressumPhone: map['impressum_phone'] ?? SITE_SETTINGS_DEFAULTS.impressumPhone,
    impressumEmail: map['impressum_email'] ?? SITE_SETTINGS_DEFAULTS.impressumEmail,
    datenschutzContent: map['datenschutz_content'] ?? SITE_SETTINGS_DEFAULTS.datenschutzContent,
    datenschutzContentEn: map['datenschutz_content_en'] ?? '',
    consentPlaceholderUrl: map['consent_placeholder_url'] ?? SITE_SETTINGS_DEFAULTS.consentPlaceholderUrl,
    noiseOpacity: parseFloat(map['noise_opacity'] ?? '') || SITE_SETTINGS_DEFAULTS.noiseOpacity,
    crtScanlinesEnabled:
      map['crt_scanlines_enabled'] !== undefined
        ? map['crt_scanlines_enabled'] === 'true'
        : SITE_SETTINGS_DEFAULTS.crtScanlinesEnabled,
    vignetteIntensity: parseFloat(map['vignette_intensity'] ?? '') || SITE_SETTINGS_DEFAULTS.vignetteIntensity,
    shopifyStoreUrl: map['shopify_store_url'] ?? SITE_SETTINGS_DEFAULTS.shopifyStoreUrl,
    youtubeChannelId: map['youtube_channel_id'] ?? SITE_SETTINGS_DEFAULTS.youtubeChannelId,
    videosPerPage: parseInt(map['videos_per_page'] ?? '') || SITE_SETTINGS_DEFAULTS.videosPerPage,
    videosLinkToPage: map['videos_link_to_page'] === 'true',
    concertsPerPage: parseInt(map['concerts_per_page'] ?? '') || SITE_SETTINGS_DEFAULTS.concertsPerPage,
    concertsLinkToPage: map['concerts_link_to_page'] === 'true',
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
    heroDefaultPrimaryBtnLabel: map['hero_default_primary_btn_label'] ?? '',
    heroDefaultSecondaryBtnLabel: map['hero_default_secondary_btn_label'] ?? '',
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
    homepageNewsCount: parseInt(map['homepage_news_count'] ?? '') || SITE_SETTINGS_DEFAULTS.homepageNewsCount,
    contactTopics,
    customSocialLinks: (() => {
      try {
        const parsed = JSON.parse(map['custom_social_links'] ?? '[]') as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.filter((entry): entry is CustomSocialLink => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
          const c = entry as Record<string, unknown>
          return typeof c['id'] === 'string' && typeof c['label'] === 'string' && typeof c['url'] === 'string' && typeof c['icon'] === 'string'
        })
      } catch { /* ignore */ }
      return []
    })(),
    submitHubUrl: map['submit_hub_url'] ?? '',
    submitHubLabel: map['submit_hub_label'] ?? '',
    submitHubDescription: map['submit_hub_description'] ?? '',
    submitHubSectionHeading: map['submit_hub_section_heading'] ?? '',
    showAboutInHeader: map['show_about_in_header'] !== 'false',
    showAboutInFooter: map['show_about_in_footer'] !== 'false',
    aboutNavLabel: map['about_nav_label'] ?? 'About',
    themePrimary: map['theme_primary'] ?? '',
    themeSecondary: map['theme_secondary'] ?? '',
    themeBackground: map['theme_background'] ?? '',
    themeForeground: map['theme_foreground'] ?? '',
    themeCard: map['theme_card'] ?? '',
    themeMuted: map['theme_muted'] ?? '',
    themeAccent: map['theme_accent'] ?? '',
    themeBorder: map['theme_border'] ?? '',
    themeGradientHeroFrom: map['theme_gradient_hero_from'] ?? '',
    themeGradientHeroTo: map['theme_gradient_hero_to'] ?? '',
    themeGradientHeroDir: map['theme_gradient_hero_dir'] ?? '135deg',
    themeGradientAccentFrom: map['theme_gradient_accent_from'] ?? '',
    themeGradientAccentTo: map['theme_gradient_accent_to'] ?? '',
    themeGradientAccentDir: map['theme_gradient_accent_dir'] ?? '135deg',
    themeConfig: parseThemeConfig(map['theme_config'] ?? null) ?? themeConfigFromFlatFields({
      themePrimary: map['theme_primary'],
      themeSecondary: map['theme_secondary'],
      themeBackground: map['theme_background'],
      themeForeground: map['theme_foreground'],
      themeCard: map['theme_card'],
      themeMuted: map['theme_muted'],
      themeAccent: map['theme_accent'],
      themeBorder: map['theme_border'],
      themeGradientHeroFrom: map['theme_gradient_hero_from'],
      themeGradientHeroTo: map['theme_gradient_hero_to'],
      themeGradientHeroDir: map['theme_gradient_hero_dir'],
      themeGradientAccentFrom: map['theme_gradient_accent_from'],
      themeGradientAccentTo: map['theme_gradient_accent_to'],
      themeGradientAccentDir: map['theme_gradient_accent_dir'],
    }),
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

/**
 * Read the structured ThemeConfig from the `theme_config` key in site_settings.
 * Falls back to reconstructing a ThemeConfig from the legacy flat theme_* keys.
 * Returns null only when the DB cannot be reached.
 */
export async function readThemeConfig(db: DbClient): Promise<ThemeConfig | null> {
  const { data, error } = await db
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'theme_config',
      'theme_primary', 'theme_secondary', 'theme_background', 'theme_foreground',
      'theme_card', 'theme_muted', 'theme_accent', 'theme_border',
      'theme_gradient_hero_from', 'theme_gradient_hero_to', 'theme_gradient_hero_dir',
      'theme_gradient_accent_from', 'theme_gradient_accent_to', 'theme_gradient_accent_dir',
    ])
  if (error) return null
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  const parsed = parseThemeConfig(map['theme_config'] ?? null)
  if (parsed) return parsed
  return themeConfigFromFlatFields({
    themePrimary: map['theme_primary'],
    themeSecondary: map['theme_secondary'],
    themeBackground: map['theme_background'],
    themeForeground: map['theme_foreground'],
    themeCard: map['theme_card'],
    themeMuted: map['theme_muted'],
    themeAccent: map['theme_accent'],
    themeBorder: map['theme_border'],
    themeGradientHeroFrom: map['theme_gradient_hero_from'],
    themeGradientHeroTo: map['theme_gradient_hero_to'],
    themeGradientHeroDir: map['theme_gradient_hero_dir'],
    themeGradientAccentFrom: map['theme_gradient_accent_from'],
    themeGradientAccentTo: map['theme_gradient_accent_to'],
    themeGradientAccentDir: map['theme_gradient_accent_dir'],
  })
}

/**
 * Persist a ThemeConfig atomically as the `theme_config` JSON key in site_settings.
 * Also back-fills the legacy flat keys so older code paths still read correct values.
 */
export async function upsertThemeConfig(db: DbClient, config: ThemeConfig): Promise<void> {
  const rows: Array<{ key: string; value: string }> = [
    { key: 'theme_config', value: JSON.stringify(config) },
    // Keep legacy flat keys in sync so old read paths remain correct.
    { key: 'theme_primary',               value: config.colors.primary },
    { key: 'theme_secondary',             value: config.colors.secondary },
    { key: 'theme_background',            value: config.colors.background },
    { key: 'theme_foreground',            value: config.colors.foreground },
    { key: 'theme_card',                  value: config.colors.card },
    { key: 'theme_muted',                 value: config.colors.muted },
    { key: 'theme_accent',                value: config.colors.accent },
    { key: 'theme_border',                value: config.colors.border },
    { key: 'theme_gradient_hero_from',    value: config.gradients.heroFrom    ?? '' },
    { key: 'theme_gradient_hero_to',      value: config.gradients.heroTo      ?? '' },
    { key: 'theme_gradient_hero_dir',     value: config.gradients.heroDir     ?? '135deg' },
    { key: 'theme_gradient_accent_from',  value: config.gradients.accentFrom  ?? '' },
    { key: 'theme_gradient_accent_to',    value: config.gradients.accentTo    ?? '' },
    { key: 'theme_gradient_accent_dir',   value: config.gradients.accentDir   ?? '135deg' },
  ]
  const { error } = await db.from('site_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

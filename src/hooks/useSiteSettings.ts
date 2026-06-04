import { useState, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_SECTION_ORDER } from '@/config/sections'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'
import { getSiteSettings, upsertSiteSettings } from '@/lib/api/siteSettings'
import type { SiteSettings } from '@/types'

const DEFAULT_SETTINGS: SiteSettings = {
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
  carouselAutoplayMs: 0,
  videosPerPage: 9,
  videosLinkToPage: false,
  featureToggles: { promoPool: true, editorTools: true },
  logoUrl: '',
  faviconUrl: '',
  aboutHeadline: '',
  aboutSubheading: '',
  aboutBody: '',
  homepageSectionOrder: DEFAULT_SECTION_ORDER,
  heroDefaultPrimaryBtnLabel: '',
  heroDefaultSecondaryBtnLabel: '',
}

/** Maps a SiteSettings domain object back to DB key-value pairs. */
function settingsToRecord(s: SiteSettings): Record<string, string> {
  return {
    label_name: s.labelName,
    label_tagline: s.labelTagline,
    contact_email: s.contactEmail,
    privacy_policy_url: s.privacyPolicyUrl,
    terms_url: s.termsUrl,
    instagram_url: s.instagramUrl,
    youtube_url: s.youtubeUrl,
    spotify_url: s.spotifyUrl,
    spotify_playlist_uri: s.spotifyPlaylistUri,
    spotify_playlists: JSON.stringify(s.spotifyPlaylists ?? []),
    hero_badge: s.heroBadge,
    hero_news_badge: s.heroNewsBadge,
    hero_description: s.heroDescription,
    hero_content_type: s.heroContentType ?? 'release',
    hero_featured_id: s.heroFeaturedId ?? '',
    hero_custom_bg_url: s.heroCustomBgUrl ?? '',
    hero_default_primary_btn_label: s.heroDefaultPrimaryBtnLabel ?? '',
    hero_default_secondary_btn_label: s.heroDefaultSecondaryBtnLabel ?? '',
    seo_title: s.seoTitle,
    seo_description: s.seoDescription,
    og_title: s.ogTitle,
    og_description: s.ogDescription,
    impressum_company_name: s.impressumCompanyName,
    impressum_legal_form: s.impressumLegalForm,
    impressum_representative: s.impressumRepresentative,
    impressum_address: s.impressumAddress,
    impressum_vat_id: s.impressumVatId,
    impressum_register_court: s.impressumRegisterCourt,
    impressum_register_number: s.impressumRegisterNumber,
    impressum_phone: s.impressumPhone,
    impressum_email: s.impressumEmail,
    datenschutz_content: s.datenschutzContent,
    datenschutz_content_en: s.datenschutzContentEn ?? '',
    consent_placeholder_url: s.consentPlaceholderUrl,
    noise_opacity: String(s.noiseOpacity),
    crt_scanlines_enabled: String(s.crtScanlinesEnabled),
    vignette_intensity: String(s.vignetteIntensity),
    shopify_store_url: s.shopifyStoreUrl,
    youtube_channel_id: s.youtubeChannelId,
    carousel_autoplay_ms: String(s.carouselAutoplayMs ?? 0),
    videos_per_page: String(s.videosPerPage ?? 9),
    videos_link_to_page: String(s.videosLinkToPage ?? false),
    feature_toggles: JSON.stringify(s.featureToggles ?? { promoPool: true, editorTools: true }),
    logo_url: s.logoUrl ?? '',
    favicon_url: s.faviconUrl ?? '',
    about_headline: s.aboutHeadline ?? '',
    about_subheading: s.aboutSubheading ?? '',
    about_body: s.aboutBody ?? '',
    role_permissions: JSON.stringify(s.rolePermissions ?? {}),
    homepage_section_order: JSON.stringify(s.homepageSectionOrder ?? DEFAULT_SECTION_ORDER),
  }
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSiteSettings(supabase)
      setSettings(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  /**
   * Save updated settings to Supabase and trigger Next.js cache revalidation
   * via the server action endpoint so the public frontend reflects the change.
   */
  const saveSettings = useCallback(
    async (updated: SiteSettings): Promise<void> => {
      await upsertSiteSettings(supabase, settingsToRecord(updated))
      setSettings(updated)
      // Revalidate the Next.js server cache so the public site picks up changes
      await fetch('/api/revalidate-site-settings', { method: 'POST' })
    },
    [supabase],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { settings, isLoading, error, saveSettings, reload: load }
}

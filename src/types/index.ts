export interface Artist {
  id: string
  name: string
  slug: string
  bio: string
  genres: string[]
  imageUrl: string
  /** Optional logo/wordmark image URL shown on hover in the artists grid. */
  logoUrl?: string
  spotifyUrl?: string
  appleMusicUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  websiteUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  tiktokUrl?: string
  bandcampUrl?: string
  shopUrl?: string
  /** When true, this artist is guaranteed to appear in the homepage Artists section regardless of shuffle. */
  featured: boolean
  country?: string
  email?: string
  vatNumber?: string
  isEuNonGerman?: boolean
  notes?: string
  spotifyId?: string
  discogsId?: string
  songkickId?: string
  bandsintownId?: string
  lastSyncedAt?: string
  foundedYear?: number
  isVisible: boolean
  /** Per-platform streaming URLs resolved via the Odesli API (Deezer, Tidal, Amazon Music, etc.) */
  platformLinks?: Record<string, string>
}

export interface SyncLog {
  id: string
  artistId: string | null
  status: 'success' | 'partial' | 'error'
  message: string | null
  releasesSynced: number
  errors: string[]
  apiSource: string
  rateLimited: boolean
  createdAt: string
}

/**
 * Configuration for a single CTA button in the Hero section.
 * When omitted, the Hero falls back to its default behaviour.
 */
export interface HeroButton {
  /** Custom label. Falls back to the dictionary key when empty/undefined. */
  label?: string
  /** How the button behaves: navigate to a URL, scroll to a page section, or hide it entirely. */
  action?: 'link' | 'scroll' | 'none'
  /**
   * For action='link'  : absolute or relative URL (e.g. '/releases/abc', 'https://open.spotify.com/…').
   * For action='scroll': CSS selector of the target section (e.g. '#releases').
   */
  href?: string
}

export interface Release {
  id: string
  title: string
  artistId: string
  artistName: string
  releaseDate: string
  coverArt: string
  type: 'album' | 'ep' | 'single'
  spotifyUrl?: string
  appleMusicUrl?: string
  youtubeUrl?: string
  featured: boolean
  itunesId?: string
  spotifyId?: string
  discogsId?: string
  isrc?: string
  barcode?: string
  catalogNumber?: string
  previewUrl?: string
  smartUrl?: string
  /** Per-platform streaming URLs resolved via the Odesli API (Deezer, Tidal, Amazon Music, etc.) */
  platformLinks?: Record<string, string>
  popularity?: number
  isVisible: boolean
  /** When true, this release is only visible in the journalist Promo Pool and never shown on the public homepage. */
  isPromo: boolean
  /** Optional promo/teaser text shown in the Hero section when this release is featured. */
  promoText?: string
  /** Optional hero background image URL, different from the release cover art. */
  heroBgUrl?: string
  /** Custom configuration for the primary CTA button in the Hero section. */
  heroPrimaryBtn?: HeroButton
  /** Custom configuration for the secondary CTA button in the Hero section. */
  heroSecondaryBtn?: HeroButton
}

export interface NewsPost {
  id: string
  title: string
  excerpt: string
  content: string
  publishedAt: string
  imageUrl?: string
  slug: string
  isPressOnly: boolean
  /**
   * Optional artist association. When set, this news post is shown only on that
   * artist's profile page and not under any other artist.
   */
  artistId?: string | null
  /**
   * Post lifecycle status:
   * - `draft`     — only visible to admins/editors
   * - `published` — public (and `published_at` ≤ now)
   * - `scheduled` — will become public at `published_at` (which is in the future)
   * - `archived`  — removed from public view, kept for record
   */
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  /** Optional embargo timestamp — content is hidden until this time passes */
  embargoUntil?: string | null
  /** Contact person/email for this press release */
  mediaContact?: string | null
  /** Category of press release, e.g. "album announcement", "tour", "label news" */
  releaseCategory?: string | null
  /** Custom configuration for the primary CTA button in the Hero section. */
  heroPrimaryBtn?: HeroButton
  /** Custom configuration for the secondary CTA button in the Hero section. */
  heroSecondaryBtn?: HeroButton
}

export interface PortalFeatureFlag {
  id: string
  label: string
  enabled: boolean
  targetRole: 'artist' | 'journalist'
  updatedAt: string
}

export interface LabelMessage {
  id: string
  artistId: string
  subject: string
  body: string
  bodyHtml?: string | null
  read: boolean
  readAt?: string | null
  starred?: boolean
  deletedAt?: string | null
  sentAt: string
}

export interface ArtistReply {
  id: string
  messageId: string
  artistId: string
  body: string
  bodyHtml?: string | null
  deletedAt?: string | null
  sentAt: string
}

export interface MessageTemplate {
  id: string
  name: string
  subject: string
  bodyHtml: string
  createdAt: string
}

export interface JournalistDownload {
  id: string
  journalistId: string
  releaseId: string | null
  assetKey: string
  downloadedAt: string
}

export interface AccreditationRequest {
  id: string
  journalistId: string
  eventName: string
  eventDate: string
  publication: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote?: string
  createdAt: string
  updatedAt: string
}

export interface Video {
  id: string
  title: string
  artistName: string
  artistId?: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
  isVisible: boolean
  isShort: boolean
}

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'editor' | 'journalist' | 'user' | 'artist'
  createdAt: string
  updatedAt: string
}

export interface Asset {
  id: string
  filename: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  r2Key: string
  publicUrl: string
  uploadedBy?: string
  createdAt: string
  folderId?: string
  artistId?: string
  artistIds: string[]
  releaseId?: string
  tags: string[]
  sha256Hash?: string
}

export interface AssetFolder {
  id: string
  name: string
  parentId: string | null
  artistId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  children?: AssetFolder[]
  assetCount?: number
}

export interface ArtistAsset {
  id: string
  artistId: string
  filename: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  r2Key: string
  publicUrl: string
  label?: string
  createdAt: string
}

export interface SpotifyPlaylistEntry {
  label: string
  uri: string
  /** Spotify embed theme. 'dark' is the default Spotify look; 'light' inverts it. */
  theme?: 'dark' | 'light'
  /** Optional hex accent colour used for the tab-selector button in the multi-player UI. */
  accentColor?: string
}

export interface FeatureToggles {
  /** Enable/disable the journalist Promo Pool area. Default: true */
  promoPool: boolean
  /** Enable/disable editor access to the admin CMS. Default: true */
  editorTools: boolean
}

/** Identifies a reorderable section on the public homepage. */
export type HomepageSection = 'releases' | 'spotify' | 'videos' | 'concerts' | 'news' | 'newsletter'

export interface SiteSettings {
  labelName: string
  labelTagline: string
  contactEmail: string
  privacyPolicyUrl: string
  termsUrl: string
  instagramUrl: string
  youtubeUrl: string
  spotifyUrl: string
  spotifyPlaylistUri: string
  /** Multiple playlists for the multi-player. Falls back to spotifyPlaylistUri when empty. */
  spotifyPlaylists: SpotifyPlaylistEntry[]
  heroBadge: string
  heroNewsBadge: string
  heroDescription: string
  seoTitle: string
  seoDescription: string
  ogTitle: string
  ogDescription: string
  /** Impressum (Legal Notice) fields — required by German law */
  impressumCompanyName: string
  impressumLegalForm: string
  impressumRepresentative: string
  impressumAddress: string
  impressumVatId: string
  impressumRegisterCourt: string
  impressumRegisterNumber: string
  impressumPhone: string
  impressumEmail: string
  /** Full privacy policy text (Markdown or HTML). Displayed on /datenschutz. */
  datenschutzContent: string
  /** English privacy policy text (Markdown or HTML). Displayed on /datenschutz for the EN locale. */
  datenschutzContentEn?: string
  /** URL of the placeholder image shown in ConsentGate before the user opts in. */
  consentPlaceholderUrl: string
  /** Visual overlay: animated noise/grain opacity (0–1). Default 0.04. */
  noiseOpacity: number
  /** Visual overlay: whether CRT scanline effect is active. */
  crtScanlinesEnabled: boolean
  /** Visual overlay: vignette intensity (0–1). Default 0.5. */
  vignetteIntensity: number
  /** Shopify / Darkmerch store URL. Empty string when not configured. */
  shopifyStoreUrl: string
  /** YouTube channel ID for video sync. */
  youtubeChannelId: string
  /** Number of videos shown per page in the Videos grid. Default: 9. */
  videosPerPage: number
  /** When true, the Videos section on the homepage shows only the first page and links to /videos for all videos. */
  videosLinkToPage: boolean
  /** Auto-advance interval for the releases carousel in ms. 0 = disabled. Default 0. */
  carouselAutoplayMs: number
  /** Feature flags: enable/disable portal modules globally. */
  featureToggles: FeatureToggles
  /** R2 URL of the custom label logo shown in the header and footer. Falls back to static asset when empty. */
  logoUrl?: string
  /** R2 URL of the custom favicon. Used in <head> meta. Falls back to /icons/icon-192.png when empty. */
  faviconUrl?: string
  /** Custom headline for the About page. Falls back to i18n default when empty. */
  aboutHeadline?: string
  /** Custom subheading for the About page. Falls back to i18n default when empty. */
  aboutSubheading?: string
  /** Main About page body text (Markdown or HTML). Rendered on /about. */
  aboutBody?: string
  // ── Section Text Overrides ────────────────────────────────────────────────
  /** Override for the newsletter section heading. Falls back to i18n default when empty. */
  newsletterHeading?: string
  /** Override for the newsletter section description. Falls back to i18n default when empty. */
  newsletterDescription?: string
  /** Override for the Spotify section heading. Falls back to i18n default when empty. */
  spotifySectionHeading?: string
  /** Override for the Spotify section subheading. Falls back to i18n default when empty. */
  spotifySectionSubheading?: string
  /** Override for the Videos section heading. Falls back to i18n default when empty. */
  videosSectionHeading?: string
  /** Override for the Videos section subheading. Falls back to i18n default when empty. */
  videosSectionSubheading?: string
  /** Override for the News section heading. Falls back to i18n default when empty. */
  newsSectionHeading?: string
  /** Override for the News section subheading. Falls back to i18n default when empty. */
  newsSectionSubheading?: string
  /** Override for the Concerts section heading. Falls back to i18n default when empty. */
  concertsSectionHeading?: string
  /** Override for the Concerts section subheading. Falls back to i18n default when empty. */
  concertsSectionSubheading?: string
  /** Override for the Releases section heading. Falls back to i18n default when empty. */
  releasesSectionHeading?: string
  /** Override for the Releases section subheading. Falls back to i18n default when empty. */
  releasesSectionSubheading?: string
  // ── Hero Section ──────────────────────────────────────────────────────────
  /** What the hero section features. 'release' = latest/featured release, 'news' = latest news post. Default: 'release'. */
  heroContentType?: 'release' | 'news'
  /** ID of the specific release or news post to feature. Empty = auto-pick the latest featured item. */
  heroFeaturedId?: string
  /** R2 URL of a custom hero background image that overrides the release/news cover art. */
  heroCustomBgUrl?: string
  /** Global fallback label for the hero primary button when item-level label is not set. */
  heroDefaultPrimaryBtnLabel?: string
  /** Global fallback label for the hero secondary button when item-level label is not set. */
  heroDefaultSecondaryBtnLabel?: string
  // ── Homepage Section Order ────────────────────────────────────────────────
  /**
   * Order in which the reorderable sections appear on the homepage.
   * Hero is always first and is not included here.
   * Defaults to ['releases','spotify','videos','concerts','news','newsletter'].
   */
  homepageSectionOrder?: HomepageSection[]
  // ── Role Permissions ──────────────────────────────────────────────────────
  /**
   * Per-role permission map. Keys are role names ('admin','editor','journalist','user','artist').
   * Stored as JSON in site_settings under key 'role_permissions'.
   */
  rolePermissions?: Record<string, RolePermissions>
}

/** Granular permission flags configurable per role. */
export interface RolePermissions {
  canPublishNews: boolean
  canEditNews: boolean
  canManageArtists: boolean
  canManageReleases: boolean
  canManageVideos: boolean
  canViewAdminPanel: boolean
}

export interface Concert {
  id: string
  artistId: string | null
  artistName: string
  eventName: string
  venueName: string | null
  venueCity: string | null
  venueCountry: string | null
  concertDate: string
  ticketUrl: string | null
  songkickId: string | null
  bandsintownId: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface NewsletterSubscriber {
  id: string
  email: string
  name: string | null
  subscribedAt: string
  source: string
}

export interface Artist {
  id: string
  name: string
  slug: string
  bio: string
  genres: string[]
  imageUrl: string
  spotifyUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  websiteUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  tiktokUrl?: string
  bandcampUrl?: string
  shopUrl?: string
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
  popularity?: number
  isVisible: boolean
}

export interface NewsPost {
  id: string
  title: string
  excerpt: string
  content: string
  publishedAt: string
  imageUrl?: string
  slug: string
}

export interface Video {
  id: string
  title: string
  artistName: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
}

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'editor' | 'journalist' | 'user'
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
}

export interface SpotifyPlaylistEntry {
  label: string
  uri: string
}

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
  /** Full privacy policy text (Markdown). Displayed on /datenschutz. */
  datenschutzContent: string
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

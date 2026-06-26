import type { Database } from '@/types/database'
import { stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'

type ReleaseInsert = Database['public']['Tables']['releases']['Insert']
type ReleaseUpdate = Database['public']['Tables']['releases']['Update']
type NewsInsert = Database['public']['Tables']['news_posts']['Insert']
type NewsUpdate = Database['public']['Tables']['news_posts']['Update']
type ArtistInsert = Database['public']['Tables']['artists']['Insert']
type ArtistUpdate = Database['public']['Tables']['artists']['Update']

function cleanText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  return stripEmojis(value)
}

function cleanHtml(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  return stripEmojisFromHtml(value)
}

export function sanitizeReleaseWrite<T extends ReleaseInsert | ReleaseUpdate>(data: T): T {
  const next = { ...data }
  if (typeof next.title === 'string') next.title = stripEmojis(next.title)
  if (typeof next.promo_text === 'string') next.promo_text = cleanText(next.promo_text) ?? null
  if (typeof next.guest_artists === 'string') next.guest_artists = cleanText(next.guest_artists) ?? null
  return next
}

export function sanitizeNewsWrite<T extends NewsInsert | NewsUpdate>(data: T): T {
  const next = { ...data }
  if (typeof next.title === 'string') next.title = stripEmojis(next.title)
  if (typeof next.slug === 'string') next.slug = stripEmojis(next.slug)
  if (typeof next.excerpt === 'string') next.excerpt = cleanText(next.excerpt) ?? null
  if (typeof next.content === 'string') next.content = cleanHtml(next.content) ?? ''
  return next
}

export function sanitizeArtistWrite<T extends ArtistInsert | ArtistUpdate>(data: T): T {
  const next = { ...data }
  if (typeof next.name === 'string') next.name = stripEmojis(next.name)
  if (typeof next.bio === 'string') next.bio = cleanText(next.bio) ?? null
  if (typeof next.notes === 'string') next.notes = cleanText(next.notes) ?? null
  if (typeof next.hometown === 'string') next.hometown = cleanText(next.hometown) ?? null
  if (typeof next.country === 'string') next.country = cleanText(next.country) ?? null
  return next
}

export const SITE_SETTINGS_TEXT_KEYS = new Set([
  'label_tagline',
  'about_headline',
  'about_subheading',
  'about_body',
  'about_nav_label',
  'contact_intro',
  'newsletter_heading',
  'newsletter_subheading',
  'footer_tagline',
])

export function sanitizeSiteSettingsWrite(
  settings: Partial<Record<string, string>>,
): Partial<Record<string, string>> {
  const next: Partial<Record<string, string>> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (value == null) {
      next[key] = value
      continue
    }
    next[key] = SITE_SETTINGS_TEXT_KEYS.has(key) ? stripEmojis(value) : value
  }
  return next
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { containsEmojis, stripEmojis, stripEmojisFromHtml } from '@/lib/stripEmojis'

type DbClient = SupabaseClient<Database>

const SITE_SETTINGS_TEXT_KEYS = new Set([
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

function cleanOptionalText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  const cleaned = stripEmojis(value)
  return cleaned === value ? value : cleaned
}

/**
 * Persists emoji cleanup for existing rows that still contain emojis.
 * Returns the number of records updated.
 */
export async function persistEmojiCleanup(db: DbClient): Promise<number> {
  let updated = 0

  const { data: releases, error: releasesError } = await db
    .from('releases')
    .select('id, title, promo_text, guest_artists')
  if (releasesError) throw new Error(releasesError.message)

  for (const row of releases ?? []) {
    const patch: {
      title?: string
      promo_text?: string | null
      guest_artists?: string | null
    } = {}

    const title = cleanOptionalText(row.title)
    if (title !== row.title && typeof title === 'string') patch.title = title

    const promoText = cleanOptionalText(row.promo_text)
    if (promoText !== row.promo_text) patch.promo_text = promoText ?? null

    const guestArtists = cleanOptionalText(row.guest_artists)
    if (guestArtists !== row.guest_artists) patch.guest_artists = guestArtists ?? null

    if (Object.keys(patch).length === 0) continue

    const { error } = await db.from('releases').update(patch).eq('id', row.id)
    if (error) throw new Error(error.message)
    updated++
  }

  const { data: newsPosts, error: newsError } = await db
    .from('news_posts')
    .select('id, title, excerpt, content')
  if (newsError) throw new Error(newsError.message)

  for (const row of newsPosts ?? []) {
    const patch: {
      title?: string
      excerpt?: string | null
      content?: string
    } = {}

    const title = cleanOptionalText(row.title)
    if (title !== row.title && typeof title === 'string') patch.title = title

    const excerpt = cleanOptionalText(row.excerpt)
    if (excerpt !== row.excerpt) patch.excerpt = excerpt ?? null

    if (row.content && containsEmojis(row.content)) {
      patch.content = stripEmojisFromHtml(row.content)
    }

    if (Object.keys(patch).length === 0) continue

    const { error } = await db.from('news_posts').update(patch).eq('id', row.id)
    if (error) throw new Error(error.message)
    updated++
  }

  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, name, bio, notes, hometown, country')
  if (artistsError) throw new Error(artistsError.message)

  for (const row of artists ?? []) {
    const patch: {
      name?: string
      bio?: string | null
      notes?: string | null
      hometown?: string | null
      country?: string | null
    } = {}

    const name = cleanOptionalText(row.name)
    if (name !== row.name && typeof name === 'string') patch.name = name

    const bio = cleanOptionalText(row.bio)
    if (bio !== row.bio) patch.bio = bio ?? null

    const notes = cleanOptionalText(row.notes)
    if (notes !== row.notes) patch.notes = notes ?? null

    const hometown = cleanOptionalText(row.hometown)
    if (hometown !== row.hometown) patch.hometown = hometown ?? null

    const country = cleanOptionalText(row.country)
    if (country !== row.country) patch.country = country ?? null

    if (Object.keys(patch).length === 0) continue

    const { error } = await db.from('artists').update(patch).eq('id', row.id)
    if (error) throw new Error(error.message)
    updated++
  }

  const { data: settings, error: settingsError } = await db
    .from('site_settings')
    .select('key, value')
  if (settingsError) throw new Error(settingsError.message)

  for (const row of settings ?? []) {
    if (!SITE_SETTINGS_TEXT_KEYS.has(row.key)) continue
    if (!row.value || !containsEmojis(row.value)) continue

    const cleaned = stripEmojis(row.value)
    const { error } = await db
      .from('site_settings')
      .update({ value: cleaned })
      .eq('key', row.key)
    if (error) throw new Error(error.message)
    updated++
  }

  return updated
}
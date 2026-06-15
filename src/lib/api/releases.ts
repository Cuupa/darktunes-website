import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Release } from '@/types'

type DbClient = SupabaseClient<Database>
type ReleaseRow = Database['public']['Tables']['releases']['Row']
export type ReleaseInsert = Database['public']['Tables']['releases']['Insert']
export type ReleaseUpdate = Database['public']['Tables']['releases']['Update']

/** Compact artist shape returned from the junction table join. */
interface JunctionArtist {
  artist_id: string
  sort_order: number
  artists: { id: string; name: string; slug: string } | null
}

function rowToRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id ?? '',
    artistName: '',
    releaseDate: row.release_date,
    coverArt: row.cover_art ?? '',
    type: row.type,
    spotifyUrl: row.spotify_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    bandcampUrl: row.bandcamp_url ?? undefined,
    smartlinkUrl: row.smartlink_url ?? undefined,
    featured: row.featured,
    itunesId: row.itunes_id ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
    discogsId: row.discogs_id ?? undefined,
    isrc: row.isrc ?? undefined,
    barcode: row.barcode ?? undefined,
    catalogNumber: row.catalog_number ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    smartUrl: row.smart_url ?? undefined,
    platformLinks: row.platform_links ?? undefined,
    popularity: row.popularity ?? undefined,
    isVisible: row.is_visible,
    isPromo: row.is_promo,
    promoText: row.promo_text ?? undefined,
    heroBgUrl: row.hero_bg_url ?? undefined,
    heroPrimaryBtn: (row.hero_primary_btn_action || row.hero_primary_btn_label || row.hero_primary_btn_href)
      ? {
          label: row.hero_primary_btn_label ?? undefined,
          action: (row.hero_primary_btn_action as 'link' | 'scroll' | 'none') ?? undefined,
          href: row.hero_primary_btn_href ?? undefined,
        }
      : undefined,
    heroSecondaryBtn: (row.hero_secondary_btn_action || row.hero_secondary_btn_label || row.hero_secondary_btn_href)
      ? {
          label: row.hero_secondary_btn_label ?? undefined,
          action: (row.hero_secondary_btn_action as 'link' | 'scroll' | 'none') ?? undefined,
          href: row.hero_secondary_btn_href ?? undefined,
        }
      : undefined,
    guestArtists: row.guest_artists ?? undefined,
  }
}

/**
 * Attach the full artist list from the release_artists junction table.
 */
async function attachReleaseArtists(db: DbClient, releases: Release[]): Promise<Release[]> {
  if (releases.length === 0) return releases
  const ids = releases.map((r) => r.id)

  const { data, error } = await (db as DbClient)
    .from('release_artists' as const)
    .select('release_id, sort_order, artists(id, name, slug)')
    .in('release_id', ids)
    .order('sort_order', { ascending: true })

  if (error) {
    // Gracefully degrade when the junction table doesn't exist yet (e.g. schema
    // migration hasn't run) so that SSG/ISR prerendering is never blocked.
    console.warn(`release_artists lookup skipped: ${error.message}`)
    return releases
  }

  const byRelease = new Map<string, { id: string; name: string; slug: string }[]>()
  for (const row of (data ?? []) as unknown as (JunctionArtist & { release_id: string })[]) {
    if (!row.artists) continue
    if (!byRelease.has(row.release_id)) byRelease.set(row.release_id, [])
    byRelease.get(row.release_id)!.push(row.artists)
  }

  return releases.map((r) => ({
    ...r,
    artists: byRelease.get(r.id) ?? undefined,
    artistName: byRelease.get(r.id)?.[0]?.name ?? r.artistName,
  }))
}

export async function getReleasesByArtistId(db: DbClient, artistId: string): Promise<Release[]> {
  // Primary query: the legacy artist_id column (preserves error behaviour for callers)
  const { data, error } = await db
    .from('releases')
    .select('*')
    .eq('artist_id', artistId)
    .order('release_date', { ascending: false })
  if (error) throw new Error(error.message)

  const legacyReleases = (data ?? []).map(rowToRelease)
  const legacyIds = new Set(legacyReleases.map((r) => r.id))

  // Secondary: also collect releases linked via the many-to-many junction table
  const { data: junctionRows } = await (db as DbClient)
    .from('release_artists' as const)
    .select('release_id')
    .eq('artist_id', artistId)

  const extraIds = ((junctionRows ?? []) as { release_id: string }[])
    .map((r) => r.release_id)
    .filter((id) => id && !legacyIds.has(id))

  if (extraIds.length > 0) {
    const { data: extra } = await db
      .from('releases')
      .select('*')
      .in('id', extraIds)
      .order('release_date', { ascending: false })

    if (extra && extra.length > 0) {
      const merged = [
        ...legacyReleases,
        ...extra.map(rowToRelease),
      ].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
      return attachReleaseArtists(db, merged)
    }
  }

  return attachReleaseArtists(db, legacyReleases)
}

export async function getReleases(db: DbClient): Promise<Release[]> {
  const { data, error } = await db
    .from('releases')
    .select('*')
    .order('release_date', { ascending: false })
  if (error) throw new Error(error.message)
  const releases = (data ?? []).map(rowToRelease)
  return attachReleaseArtists(db, releases)
}

export async function getPromoReleases(db: DbClient): Promise<Release[]> {
  const { data, error } = await db
    .from('releases')
    .select('*')
    .eq('is_promo', true)
    .order('release_date', { ascending: false })
  if (error) throw new Error(error.message)
  const releases = (data ?? []).map(rowToRelease)
  return attachReleaseArtists(db, releases)
}

/**
 * Public-facing query: returns only visible releases whose artist is also visible.
 * Used by the public homepage (Server Component). The admin uses getReleases instead.
 */
export async function getPublicReleases(db: DbClient): Promise<Release[]> {
  // Fetch IDs of hidden artists so we can exclude their releases
  const { data: hiddenArtistRows, error: hiddenErr } = await db
    .from('artists')
    .select('id')
    .eq('is_visible', false)
  if (hiddenErr) throw new Error(hiddenErr.message)

  const hiddenIds = (hiddenArtistRows ?? []).map((a) => a.id)

  let builder = db
    .from('releases')
    .select('*')
    .eq('is_visible', true)
    .eq('is_promo', false)
    .order('release_date', { ascending: false })

  if (hiddenIds.length > 0) {
    // Keep releases with no artist OR whose artist is not hidden
    builder = builder.or(`artist_id.is.null,artist_id.not.in.(${hiddenIds.join(',')})`)
  }

  const { data, error } = await builder
  if (error) throw new Error(error.message)
  const releases = (data ?? []).map(rowToRelease)
  return attachReleaseArtists(db, releases)
}

export async function getReleaseById(db: DbClient, id: string): Promise<Release | null> {
  const { data, error } = await db.from('releases').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToRelease(data) : null
}

export async function createRelease(db: DbClient, releaseData: ReleaseInsert): Promise<Release> {
  const { data, error } = await db.from('releases').insert(releaseData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createRelease')
  return rowToRelease(data)
}

export async function updateRelease(
  db: DbClient,
  id: string,
  releaseData: ReleaseUpdate,
): Promise<Release> {
  const { data, error } = await db
    .from('releases')
    .update(releaseData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateRelease')
  return rowToRelease(data)
}

export async function deleteRelease(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('releases').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Calendar query: returns all visible, non-promo releases whose artist is also
 * visible. Includes artist names via the junction table.
 * Used by the Artist Portal Release Calendar.
 */
export async function getAllVisibleReleasesForCalendar(db: DbClient): Promise<Release[]> {
  const { data: hiddenArtistRows, error: hiddenErr } = await db
    .from('artists')
    .select('id')
    .eq('is_visible', false)
  if (hiddenErr) throw new Error(hiddenErr.message)

  const hiddenIds = (hiddenArtistRows ?? []).map((a) => a.id)

  let builder = db
    .from('releases')
    .select('*')
    .eq('is_visible', true)
    .eq('is_promo', false)
    .order('release_date', { ascending: true })

  if (hiddenIds.length > 0) {
    builder = builder.or(`artist_id.is.null,artist_id.not.in.(${hiddenIds.join(',')})`)
  }

  const { data, error } = await builder
  if (error) throw new Error(error.message)
  const releases = (data ?? []).map(rowToRelease)
  return attachReleaseArtists(db, releases)
}

export async function upsertReleaseByItunesId(
  db: DbClient,
  releaseData: ReleaseInsert,
): Promise<Release> {
  let featured = releaseData.featured ?? false

  if (releaseData.itunes_id) {
    const { data: existing, error: existingErr } = await db
      .from('releases')
      .select('id, featured')
      .eq('itunes_id', releaseData.itunes_id)
      .maybeSingle()

    if (existingErr) throw new Error(existingErr.message)
    featured = existing?.featured ?? featured
  }

  const { data, error } = await db
    .from('releases')
    .upsert({ ...releaseData, featured }, { onConflict: 'itunes_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertReleaseByItunesId')
  return rowToRelease(data)
}

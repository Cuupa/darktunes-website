/**
 * Published catalog research for label editors. Read-only, bounded projections:
 * never include private artist data, submission details or financial records.
 */
import { z } from 'zod'
import { registerTool } from '@/lib/ai/tools/registry'

const artistSearch = z.string().trim().min(2).max(100)
const maxItems = z.number().int().min(1).max(15).optional()
const EDITOR_CAPABILITIES = ['admin.panel.editor'] as const

/** Escape SQL LIKE wildcards so a user's search means literal artist/title text. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`
}

const publicReleaseSelect = [
  'id', 'title', 'release_date', 'type', 'artist_id',
  'spotify_url', 'apple_music_url', 'youtube_url', 'bandcamp_url', 'smartlink_url',
].join(',')

const releaseSummary = z.object({
  title: z.string(),
  release_date: z.string(),
  type: z.string(),
  spotify_url: z.string().nullable(),
  apple_music_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
  bandcamp_url: z.string().nullable(),
  smartlink_url: z.string().nullable(),
})

registerTool({
  name: 'search_editorial_artists',
  description: 'Search the public darkTunes artist roster by name for published artist profiles, bios, genres and public links. Use for editorial artist background questions, not portal help. Does not access private artist or financial data.',
  input: z.object({ query: artistSearch, limit: maxItems }).strict(),
  output: z.object({
    matches: z.array(z.object({
      name: z.string(),
      slug: z.string(),
      bio: z.string().nullable(),
      genres: z.array(z.string()),
      website_url: z.string().nullable(),
      spotify_url: z.string().nullable(),
      apple_music_url: z.string().nullable(),
      instagram_url: z.string().nullable(),
    })),
  }),
  capabilities: [...EDITOR_CAPABILITIES],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 12_000,
  timeoutMs: 8_000,
  execute: async ({ query, limit }, { actor }) => {
    const { data, error } = await actor.serviceDb.from('artists')
      .select('name,slug,bio,genres,website_url,spotify_url,apple_music_url,instagram_url')
      .eq('is_visible', true)
      .ilike('name', likePattern(query))
      .order('name')
      .limit(limit ?? 8)
    if (error) throw new Error('Published artist search failed.')
    return { matches: (data ?? []).map((row) => ({
      name: row.name,
      slug: row.slug,
      bio: row.bio?.slice(0, 1000) ?? null,
      genres: row.genres ?? [],
      website_url: row.website_url,
      spotify_url: row.spotify_url,
      apple_music_url: row.apple_music_url,
      instagram_url: row.instagram_url,
    })) }
  },
})

registerTool({
  name: 'get_editorial_artist_releases',
  description: 'Find the newest published non-promo releases for a named public darkTunes artist, including featured and compilation credits from the release_artists relation. Use for "latest release from Artist" or discography questions. Returns only published public catalog fields.',
  input: z.object({ artist: artistSearch, limit: maxItems }).strict(),
  output: z.object({
    artist: z.string().nullable(),
    candidates: z.array(z.string()),
    releases: z.array(releaseSummary),
  }),
  capabilities: [...EDITOR_CAPABILITIES],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 12_000,
  timeoutMs: 12_000,
  execute: async ({ artist, limit }, { actor }) => {
    const db = actor.serviceDb
    const { data: artists, error: artistError } = await db.from('artists')
      .select('id,name')
      .eq('is_visible', true)
      .ilike('name', likePattern(artist))
      .order('name')
      .limit(10)
    if (artistError) throw new Error('Published artist lookup failed.')
    const exact = (artists ?? []).find((row) => row.name.toLowerCase() === artist.toLowerCase())
    const selected = exact ?? ((artists ?? []).length === 1 ? artists![0] : null)
    if (!selected) {
      return { artist: null, candidates: (artists ?? []).map((row) => row.name), releases: [] }
    }

    const [direct, related] = await Promise.all([
      db.from('releases')
        .select(publicReleaseSelect)
        .eq('artist_id', selected.id)
        .eq('is_visible', true)
        .eq('is_promo', false)
        .order('release_date', { ascending: false })
        .limit(40),
      db.from('release_artists')
        .select('release_id')
        .eq('artist_id', selected.id)
        .limit(60),
    ])
    if (direct.error || related.error) throw new Error('Published release lookup failed.')
    const ids = [...new Set((related.data ?? []).map((row) => row.release_id))].slice(0, 40)
    const linked = ids.length > 0
      ? await db.from('releases')
          .select(publicReleaseSelect)
          .in('id', ids)
          .eq('is_visible', true)
          .eq('is_promo', false)
          .limit(40)
      : { data: [], error: null }
    if (linked.error) throw new Error('Published release credits lookup failed.')
    const unique = [...new Map([...(direct.data ?? []), ...(linked.data ?? [])]
      .map((row) => [row.id, row] as const)).values()]
      .sort((a, b) => b.release_date.localeCompare(a.release_date))
      .slice(0, limit ?? 10)
    return {
      artist: selected.name,
      candidates: [],
      releases: unique.map((row) => ({
        title: row.title,
        release_date: row.release_date,
        type: row.type,
        spotify_url: row.spotify_url,
        apple_music_url: row.apple_music_url,
        youtube_url: row.youtube_url,
        bandcamp_url: row.bandcamp_url,
        smartlink_url: row.smartlink_url,
      })),
    }
  },
})

registerTool({
  name: 'search_editorial_news',
  description: 'Search published, already-due public darkTunes news headlines, or list recent published headlines when query is omitted. Excludes drafts, future-scheduled news and press-only items. Useful for editorial research and related coverage.',
  input: z.object({
    query: artistSearch.optional(),
    limit: maxItems,
  }).strict(),
  output: z.object({
    items: z.array(z.object({
      title: z.string(),
      slug: z.string(),
      excerpt: z.string().nullable(),
      published_at: z.string(),
    })),
  }),
  capabilities: [...EDITOR_CAPABILITIES],
  dataScope: 'label',
  classification: 'read',
  maxResultBytes: 8_000,
  timeoutMs: 8_000,
  execute: async ({ query, limit }, { actor }) => {
    let request = actor.serviceDb.from('news_posts')
      .select('title,slug,excerpt,published_at')
      .in('status', ['published', 'scheduled'])
      .eq('is_press_only', false)
      .lte('published_at', new Date().toISOString())
    if (query) request = request.ilike('title', likePattern(query))
    const { data, error } = await request
      .order('published_at', { ascending: false })
      .limit(limit ?? 10)
    if (error) throw new Error('Published news search failed.')
    return { items: (data ?? []).map((row) => ({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt?.slice(0, 300) ?? null,
      published_at: row.published_at,
    })) }
  },
})

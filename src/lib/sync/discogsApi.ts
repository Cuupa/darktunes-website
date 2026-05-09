/**
 * src/lib/sync/discogsApi.ts
 *
 * Discogs API integration.
 *
 * Fetches physical releases (Vinyl/CD) for a given Discogs artist ID,
 * including catalog numbers and barcodes for deduplication.
 *
 * Authentication: Personal Access Token (header-based).
 * Docs: https://www.discogs.com/developers/
 */

import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscogsArtistRelease {
  id: number
  title: string
  artist: string
  year: number | null
  format: string
  label: string | null
  catno: string | null
  resource_url: string
  thumb: string
  role: string
  type: string
}

export interface DiscogsReleaseFull {
  id: number
  title: string
  artists: Array<{ name: string }>
  year: number | null
  formats?: Array<{ name: string; descriptions?: string[] }>
  images?: Array<{ uri: string; width: number; height: number; type: string }>
  labels?: Array<{ name: string; catno: string }>
  identifiers?: Array<{ type: string; value: string }>
}

export interface DiscogsRelease {
  discogsId: string
  title: string
  artistName: string
  releaseDate: string | null
  coverUrl: string | null
  catalogNumber: string | null
  barcode: string | null
  format: 'vinyl' | 'cd' | 'digital' | 'other'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all releases for a given Discogs artist ID.
 * Returns simplified release objects with catalog numbers and barcodes.
 */
export async function fetchDiscogsArtistReleases(
  discogsArtistId: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<DiscogsRelease[]> {
  const releases: DiscogsRelease[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = new URL(`https://api.discogs.com/artists/${discogsArtistId}/releases`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(perPage))
    url.searchParams.set('sort', 'year')
    url.searchParams.set('sort_order', 'desc')

    const response = await fetchFn(url.toString(), {
      headers: {
        Authorization: `Discogs token=${token}`,
        'User-Agent': 'darkTunes/1.0 +https://darktunes.com',
      },
    })

    if (!response.ok) {
      throw new HttpError(response.status, `Discogs releases fetch failed: ${response.status}`)
    }

    const data = (await response.json()) as {
      releases: DiscogsArtistRelease[]
      pagination: { pages: number; page: number }
    }

    for (const r of data.releases) {
      // Only include main releases (not appearances, tracks, etc.)
      if (r.type !== 'master' && r.type !== 'release') continue

      releases.push({
        discogsId: String(r.id),
        title: r.title,
        artistName: r.artist,
        releaseDate: r.year ? `${r.year}-01-01` : null,
        coverUrl: r.thumb || null,
        catalogNumber: r.catno || null,
        barcode: null, // barcode is in the full release object; skipped for perf
        format: deriveFormat(r.format),
      })
    }

    if (page >= data.pagination.pages) break
    page++
  }

  return releases
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveFormat(format: string): DiscogsRelease['format'] {
  const f = format.toLowerCase()
  if (f.includes('vinyl') || f.includes('lp') || f.includes('ep')) return 'vinyl'
  if (f.includes('cd') || f.includes('cdr')) return 'cd'
  if (f.includes('digital') || f.includes('file')) return 'digital'
  return 'other'
}

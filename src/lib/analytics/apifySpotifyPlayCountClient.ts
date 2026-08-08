/**
 * Thin wrapper around apify-client for beatanalytics/spotify-play-count-scraper.
 * Input shape matches the actor store schema exactly (follow flags always false).
 *
 * @see https://apify.com/beatanalytics/spotify-play-count-scraper/api/javascript
 */

import { ApifyClient } from 'apify-client'
import { ApiError } from '@/lib/errors'

export { utcPeriodMonth } from '@/lib/analytics/periodMonth'

export const APIFY_SPOTIFY_PLAY_COUNT_ACTOR = 'beatanalytics/spotify-play-count-scraper'

/** Free-tier monthly URL budget (billable input URLs). */
export const APIFY_MONTHLY_URL_BUDGET = 1200

/** Default batch size to keep each actor call under Vercel maxDuration. */
export const APIFY_URL_BATCH_SIZE = 100

/** Wait for actor completion per batch (seconds); leave headroom under 300s maxDuration. */
export const APIFY_CALL_WAIT_SECS = 270

export interface ApifySpotifyPlayCountInput {
  urls: Array<{ url: string }>
  followAlbums: false
  followSingles: false
  followPopularReleases: false
  scrapePreviewUrls: false
}

export interface ApifyArtistItem {
  id?: string
  name?: string
  followers?: number
  monthlyListeners?: number
  worldRank?: number | null
  topTracks?: Array<{
    id?: string
    name?: string
    streamCount?: number
  }>
  topCities?: Array<{
    country?: string
    city?: string
    numberOfListeners?: number
  }>
}

export interface ApifyAlbumItem {
  id?: string
  name?: string
  type?: string
  releaseDate?: string
  artists?: Array<{ id?: string; name?: string }>
  tracks?: Array<{
    id?: string
    name?: string
    streamCount?: number
    duration?: number
    contentRating?: string
  }>
}

export type ApifyDatasetItem = ApifyArtistItem & ApifyAlbumItem

export interface RunPlayCountScraperResult {
  runId: string
  status: string
  datasetId: string
  items: ApifyDatasetItem[]
  urlsInBatch: number
}

export interface ApifyPlayCountClient {
  runPlayCountScraper(urls: string[]): Promise<RunPlayCountScraperResult>
}

function buildActorInput(urls: string[]): ApifySpotifyPlayCountInput {
  return {
    urls: urls.map((url) => ({ url })),
    followAlbums: false,
    followSingles: false,
    followPopularReleases: false,
    scrapePreviewUrls: false,
  }
}

function mapApifyClientError(err: unknown): never {
  if (err instanceof ApiError) throw err

  const anyErr = err as {
    message?: string
    statusCode?: number
    type?: string
    name?: string
  }

  const statusCode = typeof anyErr.statusCode === 'number' ? anyErr.statusCode : undefined
  const rawMessage = typeof anyErr.message === 'string' ? anyErr.message : 'Unknown Apify error'
  // Never surface tokens or long stack traces
  const safeSummary = rawMessage.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 200)

  if (statusCode === 401 || statusCode === 403) {
    throw new ApiError(
      503,
      'Apify rejected the API token. Update the token under Admin → API Keys.',
      'APIFY_NOT_CONFIGURED',
    )
  }
  if (statusCode === 429) {
    throw new ApiError(
      429,
      'Apify rate-limited the request. Wait a moment and try again, or reduce batch size.',
      'APIFY_BUDGET_EXCEEDED',
    )
  }
  if (statusCode === 408 || /timeout/i.test(safeSummary)) {
    throw new ApiError(
      504,
      'The Apify scrape timed out before finishing. Partial progress may be saved; re-run to continue.',
      'APIFY_TIMEOUT',
    )
  }

  throw new ApiError(
    502,
    `Spotify play-count scrape failed on Apify. ${safeSummary}`,
    'APIFY_RUN_FAILED',
  )
}

/**
 * Create a production client. Inject `runPlayCountScraper` in tests instead.
 */
export function createApifyPlayCountClient(token: string): ApifyPlayCountClient {
  const client = new ApifyClient({
    token,
    maxRetries: 8,
    minDelayBetweenRetriesMillis: 500,
    timeoutSecs: 360,
  })

  return {
    async runPlayCountScraper(urls: string[]): Promise<RunPlayCountScraperResult> {
      if (urls.length === 0) {
        return {
          runId: '',
          status: 'SUCCEEDED',
          datasetId: '',
          items: [],
          urlsInBatch: 0,
        }
      }

      try {
        const run = await client.actor(APIFY_SPOTIFY_PLAY_COUNT_ACTOR).call(buildActorInput(urls), {
          waitSecs: APIFY_CALL_WAIT_SECS,
        })

        const status = run.status ?? 'UNKNOWN'
        const runId = run.id ?? ''
        const datasetId = run.defaultDatasetId ?? ''

        if (status === 'TIMED-OUT' || status === 'TIMING-OUT') {
          throw new ApiError(
            504,
            'The Apify scrape timed out before finishing. Partial progress may be saved; re-run to continue.',
            'APIFY_TIMEOUT',
          )
        }

        if (status !== 'SUCCEEDED') {
          throw new ApiError(
            502,
            `Spotify play-count scrape failed on Apify (status: ${status}). Check the Apify Console for run ${runId || 'details'}.`,
            'APIFY_RUN_FAILED',
          )
        }

        if (!datasetId) {
          throw new ApiError(
            502,
            'Spotify play-count scrape finished but returned no dataset. Check the Apify Console.',
            'APIFY_RUN_FAILED',
          )
        }

        const { items } = await client.dataset(datasetId).listItems()
        return {
          runId,
          status,
          datasetId,
          items: (items ?? []) as ApifyDatasetItem[],
          urlsInBatch: urls.length,
        }
      } catch (err) {
        if (err instanceof ApiError) throw err
        mapApifyClientError(err)
      }
    },
  }
}



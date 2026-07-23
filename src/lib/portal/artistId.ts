/**
 * Helpers for portal artist tenancy query params / body fields.
 */

import { ApiError } from '@/lib/errors'

/** Parse artistId from query string (artistId or artist_id). */
export function artistIdFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const raw = searchParams.get('artistId') ?? searchParams.get('artist_id')
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

/** Require a non-empty artist id or throw 400. */
export function requireArtistId(artistId: string | null | undefined): string {
  const trimmed = typeof artistId === 'string' ? artistId.trim() : ''
  if (!trimmed) throw new ApiError(400, 'artistId is required')
  return trimmed
}

/** Append ?artistId= to a portal API path. */
export function withArtistIdQuery(path: string, artistId: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}artistId=${encodeURIComponent(artistId)}`
}

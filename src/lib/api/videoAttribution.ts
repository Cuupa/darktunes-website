/**
 * src/lib/api/videoAttribution.ts
 *
 * Pure helpers for matching synced YouTube videos to label artists.
 * Extracted so the matching logic can be unit-tested independently of the
 * Next.js route handler.
 */

export interface ArtistMatcher {
  id: string
  name: string
  pattern: RegExp
}

/** Escapes all RegExp special characters in a string literal. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds an ArtistMatcher for the given artist, or returns null when the
 * artist name is blank.  The pattern matches the artist name as a whole word
 * (word-boundary anchors) so "ARIA" does not match "ARIANA".
 */
export function createArtistMatcher(artist: {
  id: string
  name: string
}): ArtistMatcher | null {
  const trimmed = artist.name.trim()
  if (!trimmed) return null
  const pattern = new RegExp(`(^|\\W)${escapeRegExp(trimmed)}(\\W|$)`, 'i')
  return { id: artist.id, name: artist.name, pattern }
}

/**
 * Returns the best artist match for a video title, or null when no artist
 * name appears in the title.
 */
export function findMatchingArtist(
  title: string,
  matchers: ArtistMatcher[],
): ArtistMatcher | null {
  return matchers.find((m) => m.pattern.test(title)) ?? null
}

/**
 * Resolves the artist_id and artist_name for a synced video.
 *
 * - When an artist's name appears in the video title → use that artist's id
 *   and name.
 * - When no match is found → artist_id is null and artist_name falls back to
 *   the YouTube channel title (the label name).
 */
export function resolveVideoArtist(
  title: string,
  channelTitle: string,
  matchers: ArtistMatcher[],
): { artistId: string | null; artistName: string } {
  const match = findMatchingArtist(title, matchers)
  return {
    artistId: match?.id ?? null,
    artistName: match?.name ?? channelTitle,
  }
}

/**
 * src/lib/sos/artistBridge.ts
 *
 * Maps a darktunes Artist record to the LabelArtist type used by the SOS
 * generator modules. The artist.id (Supabase UUID) becomes the portalId
 * used for webhook uploads.
 */

import type { Artist } from '@/types'
import type { LabelArtist } from './types'

/**
 * Maps a darktunes portal Artist to a LabelArtist suitable for SOS processing.
 */
export function mapArtistToLabelArtist(a: Artist): LabelArtist {
  return {
    id:            a.id,
    artistId:      a.id,   // portal UUID – used by sosWebhook.ts for upload
    name:          a.name,
    email:         a.email ?? '',
    vatNumber:     a.vatNumber ?? '',
    isEuNonGerman: a.isEuNonGerman ?? false,
    notes:         a.notes ?? '',
  }
}

/**
 * Maps an array of darktunes Artists to LabelArtist[], filtering out artists
 * with no name.
 */
export function mapArtistsToLabelArtists(artists: Artist[]): LabelArtist[] {
  return artists.filter(a => a.name).map(mapArtistToLabelArtist)
}

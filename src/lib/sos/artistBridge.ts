/**
 * src/lib/sos/artistBridge.ts
 *
 * Maps a darktunes Artist record to the LabelArtist type used by the SOS
 * generator modules. The artist.id (Supabase UUID) becomes the portalId
 * used for webhook uploads.
 *
 * Banking / tax fields are enriched from `artist_billing_profiles` when
 * available — SOS never imports artist master data from CSV.
 */

import type { Artist } from '@/types'
import type { LabelArtist } from './types'
import type { ArtistBillingProfile } from '@/lib/api/artistBillingProfiles'

export type BillingProfileLookup = ReadonlyMap<string, ArtistBillingProfile>

/**
 * Maps a darktunes portal Artist to a LabelArtist suitable for SOS processing.
 * Optional billing profile supplies SEPA and legal-name fields.
 */
export function mapArtistToLabelArtist(
  a: Artist,
  billing?: ArtistBillingProfile | null,
): LabelArtist {
  return {
    id: a.id,
    artistId: a.id, // portal UUID – used by sosWebhook.ts for upload
    name: a.name,
    email: a.email ?? '',
    vatNumber: a.vatNumber ?? billing?.vatId ?? '',
    isEuNonGerman: a.isEuNonGerman ?? false,
    notes: a.notes ?? '',
    accountHolder: billing?.legalName?.trim() || undefined,
    iban: billing?.iban?.replace(/\s/g, '').toUpperCase() || undefined,
    bic: billing?.bic?.trim() || undefined,
  }
}

/**
 * Maps portal Artists to LabelArtist[], filtering out artists with no name.
 * Pass a billing map keyed by artist id for SEPA / legal-name enrichment.
 */
export function mapArtistsToLabelArtists(
  artists: Artist[],
  billingByArtistId?: BillingProfileLookup,
): LabelArtist[] {
  return artists
    .filter((a) => a.name)
    .map((a) => mapArtistToLabelArtist(a, billingByArtistId?.get(a.id)))
}

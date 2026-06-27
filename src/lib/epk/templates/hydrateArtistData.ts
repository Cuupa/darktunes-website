import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist, ArtistAsset } from '@/types'
import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { stripHtml, truncateText } from '@/lib/epk/migrate/stripHtml'

function pickArtistPhoto(artist: Artist, assets: ArtistAsset[]): string | undefined {
  const imageAsset = assets.find((a) => a.mimeType.startsWith('image/'))
  return imageAsset?.publicUrl ?? artist.imageUrl ?? undefined
}

function buildLinksText(artist: Artist, profile: ArtistProfile | null): string | null {
  const lines: string[] = []
  if (artist.websiteUrl) lines.push(`Website: ${artist.websiteUrl}`)
  if (artist.spotifyUrl) lines.push(`Spotify: ${artist.spotifyUrl}`)
  if (artist.instagramUrl) lines.push(`Instagram: ${artist.instagramUrl}`)
  if (artist.youtubeUrl) lines.push(`YouTube: ${artist.youtubeUrl}`)
  for (const link of profile?.customLinks ?? []) {
    if (link.url) lines.push(`${link.label}: ${link.url}`)
  }
  return lines.length > 0 ? lines.join('\n') : null
}

function buildContactsText(profile: ArtistProfile | null): string | null {
  const lines: string[] = []
  if (profile?.bookingContact) lines.push(`Booking: ${profile.bookingContact}`)
  if (profile?.pressContact) lines.push(`Press: ${profile.pressContact}`)
  return lines.length > 0 ? lines.join('\n') : null
}

function buildBioText(artist: Artist, profile: ArtistProfile | null, short = false): string | null {
  const bio = short
    ? stripHtml(profile?.bioShort) ||
      stripHtml(profile?.bioMedium) ||
      stripHtml(artist.bio)
    : stripHtml(profile?.bioLong) ||
      stripHtml(profile?.bioMedium) ||
      stripHtml(profile?.bioShort) ||
      stripHtml(artist.bio)
  if (!bio) return null
  return truncateText(bio, short ? 600 : 2500)
}

function hydrateElement(
  el: EpkElement,
  artist: Artist,
  profile: ArtistProfile | null,
  photoUrl: string | undefined,
): EpkElement {
  if (!el.role) return el

  switch (el.role) {
    case 'artist-name':
      return { ...el, content: artist.name }
    case 'genres':
      return artist.genres?.length
        ? { ...el, content: artist.genres.join(' · ') }
        : el
    case 'bio':
      return { ...el, content: buildBioText(artist, profile, false) ?? el.content }
    case 'links':
      return { ...el, content: buildLinksText(artist, profile) ?? el.content }
    case 'contacts':
      return { ...el, content: buildContactsText(profile) ?? el.content }
    case 'quote':
      return profile?.pressQuote ? { ...el, content: `"${profile.pressQuote}"` } : el
    case 'artist-photo':
      return photoUrl && (el.type === 'image' || el.type === 'logo')
        ? { ...el, type: 'image', src: photoUrl }
        : el
    case 'logo':
      return artist.logoUrl && (el.type === 'image' || el.type === 'logo')
        ? { ...el, type: 'logo', src: artist.logoUrl }
        : el
    default:
      return el
  }
}

/** Fills template placeholder roles with the signed-in artist's profile data. */
export function hydrateTemplateWithArtistData(
  document: EpkDocumentV2,
  artist: Artist,
  profile: ArtistProfile | null,
  assets: ArtistAsset[] = [],
): EpkDocumentV2 {
  const photoUrl = pickArtistPhoto(artist, assets)
  return {
    ...document,
    metadata: { ...document.metadata, title: artist.name },
    elements: document.elements.map((el) => hydrateElement(el, artist, profile, photoUrl)),
  }
}
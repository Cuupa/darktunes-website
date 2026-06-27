import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist } from '@/types'
import type { EpkElement } from '@/lib/epk/schema/documentV2'
import { createEpkElementId } from '@/lib/epk/schema/elementIds'
import { stripHtml, truncateText } from '@/lib/epk/migrate/stripHtml'
import { getNextZIndex } from './defaults'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

export type ProfilePresetId =
  | 'bio-short'
  | 'bio-long'
  | 'social-links'
  | 'contacts'
  | 'press-quote'
  | 'artist-info'

export interface ProfilePreset {
  id: ProfilePresetId
  labelKey: string
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  { id: 'bio-short', labelKey: 'epk_preset_bio_short' },
  { id: 'bio-long', labelKey: 'epk_preset_bio_long' },
  { id: 'social-links', labelKey: 'epk_preset_social' },
  { id: 'contacts', labelKey: 'epk_preset_contacts' },
  { id: 'press-quote', labelKey: 'epk_preset_quote' },
  { id: 'artist-info', labelKey: 'epk_preset_info' },
]

function baseTextElement(
  pageId: string,
  document: EpkDocumentV2,
  content: string,
  overrides: Partial<EpkElement>,
): EpkElement {
  const page = document.pages.find((p) => p.id === pageId)
  const y = (page?.height ?? 1123) * 0.35
  return {
    id: createEpkElementId('text'),
    pageId,
    type: 'text',
    x: 48,
    y,
    width: (page?.width ?? 794) - 96,
    height: 120,
    rotation: 0,
    zIndex: getNextZIndex(document, pageId),
    locked: false,
    visible: true,
    content,
    style: {
      fill: '#ffffff',
      fontSize: 14,
      fontFamily: 'Helvetica, Arial, sans-serif',
      textAlign: 'left',
      lineHeight: 1.45,
    },
    ...overrides,
  }
}

export function buildProfilePresetElement(
  presetId: ProfilePresetId,
  pageId: string,
  document: EpkDocumentV2,
  profile: ArtistProfile,
  artist: Artist,
): EpkElement | null {
  switch (presetId) {
    case 'bio-short': {
      const bio =
        stripHtml(profile.bioShort) ||
        stripHtml(profile.bioMedium) ||
        stripHtml(artist.bio)
      if (!bio) return null
      return baseTextElement(pageId, document, truncateText(bio, 600), {
        role: 'bio',
        height: 100,
        style: { fill: '#e8e8e8', fontSize: 13, lineHeight: 1.5, textAlign: 'left' },
      })
    }
    case 'bio-long': {
      const bio =
        stripHtml(profile.bioLong) ||
        stripHtml(profile.bioMedium) ||
        stripHtml(profile.bioShort) ||
        stripHtml(artist.bio)
      if (!bio) return null
      return baseTextElement(pageId, document, truncateText(bio, 2500), {
        role: 'bio',
        height: 280,
        style: { fill: '#e8e8e8', fontSize: 12, lineHeight: 1.5, textAlign: 'left' },
      })
    }
    case 'social-links': {
      const lines: string[] = []
      if (artist.websiteUrl) lines.push(`Website: ${artist.websiteUrl}`)
      if (artist.spotifyUrl) lines.push(`Spotify: ${artist.spotifyUrl}`)
      if (artist.instagramUrl) lines.push(`Instagram: ${artist.instagramUrl}`)
      if (artist.youtubeUrl) lines.push(`YouTube: ${artist.youtubeUrl}`)
      for (const link of profile.customLinks) {
        if (link.url) lines.push(`${link.label}: ${link.url}`)
      }
      if (lines.length === 0) return null
      return baseTextElement(pageId, document, lines.join('\n'), {
        role: 'links',
        height: 140,
        style: { fill: '#c8b8ff', fontSize: 12, lineHeight: 1.6, textAlign: 'left' },
      })
    }
    case 'contacts': {
      const lines: string[] = []
      if (profile.bookingContact) lines.push(`Booking: ${profile.bookingContact}`)
      if (profile.pressContact) lines.push(`Press: ${profile.pressContact}`)
      if (lines.length === 0) return null
      return baseTextElement(pageId, document, lines.join('\n'), {
        role: 'contacts',
        height: 80,
        style: { fill: '#ffffff', fontSize: 13, lineHeight: 1.5, textAlign: 'left' },
      })
    }
    case 'press-quote': {
      if (!profile.pressQuote) return null
      return baseTextElement(pageId, document, `"${profile.pressQuote}"`, {
        role: 'quote',
        height: 100,
        style: {
          fill: '#d4c4ff',
          fontSize: 16,
          fontStyle: 'italic',
          lineHeight: 1.5,
          textAlign: 'center',
        },
      })
    }
    case 'artist-info': {
      const lines: string[] = []
      if (artist.genres?.length) lines.push(`Genres: ${artist.genres.join(', ')}`)
      if (artist.hometown) lines.push(`Hometown: ${artist.hometown}`)
      if (artist.foundedYear) lines.push(`Founded: ${artist.foundedYear}`)
      if (lines.length === 0) return null
      return baseTextElement(pageId, document, lines.join('\n'), {
        role: 'info',
        height: 80,
        style: { fill: '#a0a0a0', fontSize: 12, lineHeight: 1.5, textAlign: 'left' },
      })
    }
    default:
      return null
  }
}
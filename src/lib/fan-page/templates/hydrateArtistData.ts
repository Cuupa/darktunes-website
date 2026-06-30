import type { Artist } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

export function hydrateFanPageDocument(
  document: LandingPageDocumentV1,
  artist: Artist,
  profile: ArtistProfile | null,
): LandingPageDocumentV1 {
  return {
    ...document,
    sections: document.sections.map((section) => {
      if (section.type === 'hero') {
        return {
          ...section,
          props: {
            ...section.props,
            headline: (section.props.headline as string) || artist.name,
            subheadline: (section.props.subheadline as string) || artist.genres?.slice(0, 3).join(' · ') || '',
            image: section.props.image ?? (artist.imageUrl
              ? { src: artist.imageUrl, alt: artist.name, focalX: artist.imagePositionX ?? 50, focalY: artist.imagePositionY ?? 50, scale: artist.imageScale ?? 1, objectFit: 'cover' }
              : undefined),
          },
        }
      }
      if (section.type === 'bio') {
        const bioHtml =
          (section.props.content as string) ||
          profile?.bioMedium ||
          profile?.bioShort ||
          artist.bio ||
          ''
        return { ...section, props: { ...section.props, content: bioHtml } }
      }
      if (section.type === 'merch_shelf' && artist.shopUrl) {
        return { ...section, props: { ...section.props, shopUrl: artist.shopUrl } }
      }
      if (section.type === 'cta_banner' && artist.shopUrl && !(section.props.url as string)) {
        return { ...section, props: { ...section.props, url: artist.shopUrl } }
      }
      return section
    }),
  }
}
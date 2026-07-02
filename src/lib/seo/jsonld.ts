/**
 * src/lib/seo/jsonld.ts — JSON-LD structured-data builder functions
 *
 * Each function returns a plain schema.org object that can be embedded in a
 * Next.js RSC page via:
 *
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
 *   />
 *
 * Use `serializeJsonLd` (exported below) instead of bare `JSON.stringify`.
 * It replaces `<`, `>`, and `&` with their Unicode escape sequences so that a
 * `</script>` inside a string value cannot prematurely close the script tag.
 *
 * All URLs must be absolute; configure NEXT_PUBLIC_SITE_URL for production.
 */

import type { Artist, Release, NewsPost, SiteSettings } from '@/types'
import { resolveSiteUrl } from '@/lib/brand'
import { NEUTRAL_LABEL_NAME } from '@/lib/brand/tenantDefaults'

/** Canonical site origin (no trailing slash). Empty when NEXT_PUBLIC_SITE_URL is unset. */
export function getSiteUrl(): string {
  return resolveSiteUrl()
}

/**
 * Serialize a JSON-LD schema object to a string that is safe to embed inside a
 * `<script type="application/ld+json">` tag.
 *
 * Standard `JSON.stringify` does NOT escape `<`, `>`, or `&`, so a crafted
 * value like `"</script><script>alert(1)</script>"` could break out of the
 * enclosing script element.  Replacing those three chars with their Unicode
 * escape sequences prevents this while keeping the output valid JSON.
 */
export function serializeJsonLd(schema: unknown): string {
  return JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

/** Filter out undefined/null/empty-string values from a list. */
function compact(items: (string | undefined | null)[]): string[] {
  return items.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface OrganizationSchemaInput {
  siteSettings: Pick<SiteSettings, 'labelName' | 'contactEmail'> &
    Partial<Pick<SiteSettings, 'instagramUrl' | 'youtubeUrl' | 'spotifyUrl'>> & {
      logoUrl?: string
    }
}

export function buildOrganizationSchema({ siteSettings }: OrganizationSchemaInput) {
  const labelName = siteSettings.labelName || NEUTRAL_LABEL_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: labelName,
    url: getSiteUrl() || undefined,
    ...(siteSettings.logoUrl
      ? {
          logo: {
            '@type': 'ImageObject',
            url: siteSettings.logoUrl,
          },
        }
      : {}),
    sameAs: compact([
      siteSettings.instagramUrl,
      siteSettings.youtubeUrl,
      siteSettings.spotifyUrl,
    ]),
    contactPoint: siteSettings.contactEmail
      ? {
          '@type': 'ContactPoint',
          email: siteSettings.contactEmail,
          contactType: 'customer support',
        }
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// WebSite
// ---------------------------------------------------------------------------

export function buildWebSiteSchema(labelName: string) {
  const name = labelName || NEUTRAL_LABEL_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url: getSiteUrl() || undefined,
    potentialAction: getSiteUrl()
      ? {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${getSiteUrl()}/artists?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        }
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// MusicGroup (artist profile)
// ---------------------------------------------------------------------------

export interface MusicGroupSchemaInput {
  artist: Pick<
    Artist,
    | 'name'
    | 'slug'
    | 'bio'
    | 'imageUrl'
    | 'genres'
    | 'country'
    | 'foundedYear'
    | 'spotifyUrl'
    | 'appleMusicUrl'
    | 'instagramUrl'
    | 'youtubeUrl'
    | 'facebookUrl'
    | 'twitterUrl'
    | 'bandcampUrl'
    | 'websiteUrl'
  >
  releases: Pick<Release, 'id' | 'title' | 'releaseDate'>[]
}

export function buildMusicGroupSchema({ artist, releases }: MusicGroupSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    description: artist.bio || undefined,
    image: artist.imageUrl || undefined,
    genre: artist.genres?.length ? artist.genres : undefined,
    url: getSiteUrl() ? `${getSiteUrl()}/artists/${artist.slug}` : undefined,
    ...(artist.country
      ? {
          foundingLocation: {
            '@type': 'Place',
            name: artist.country,
          },
        }
      : {}),
    ...(artist.foundedYear ? { foundingDate: String(artist.foundedYear) } : {}),
    sameAs: compact([
      artist.spotifyUrl,
      artist.appleMusicUrl,
      artist.instagramUrl,
      artist.youtubeUrl,
      artist.facebookUrl,
      artist.twitterUrl,
      artist.bandcampUrl,
      artist.websiteUrl,
    ]),
    album: releases.map((r) => ({
      '@type': 'MusicAlbum',
      name: r.title,
      datePublished: r.releaseDate,
      url: getSiteUrl() ? `${getSiteUrl()}/releases/${r.id}` : undefined,
    })),
  }
}

// ---------------------------------------------------------------------------
// MusicAlbum (release detail)
// ---------------------------------------------------------------------------

export interface MusicAlbumSchemaInput {
  release: Pick<
    Release,
    | 'id'
    | 'title'
    | 'artistId'
    | 'artistName'
    | 'releaseDate'
    | 'coverArt'
    | 'type'
    | 'spotifyUrl'
    | 'appleMusicUrl'
    | 'youtubeUrl'
  >
  /** Slug of the artist, used to build the artist URL. Optional — omit if unknown. */
  artistSlug?: string
}

export function buildMusicAlbumSchema({ release, artistSlug }: MusicAlbumSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: release.title,
    byArtist: {
      '@type': 'MusicGroup',
      name: release.artistName,
      ...(artistSlug && getSiteUrl()
        ? { url: `${getSiteUrl()}/artists/${artistSlug}` }
        : {}),
    },
    image: release.coverArt || undefined,
    datePublished: release.releaseDate,
    url: getSiteUrl() ? `${getSiteUrl()}/releases/${release.id}` : undefined,
    ...(release.type === 'ep'
      ? { albumProductionType: 'EPRelease' }
      : release.type === 'single'
        ? { albumProductionType: 'SingleRelease' }
        : {}),
    sameAs: compact([release.spotifyUrl, release.appleMusicUrl, release.youtubeUrl]),
  }
}

// ---------------------------------------------------------------------------
// NewsArticle
// ---------------------------------------------------------------------------

export interface NewsArticleSchemaInput {
  post: Pick<NewsPost, 'title' | 'excerpt' | 'imageUrl' | 'publishedAt' | 'slug'>
  publisherName: string
  publisherLogoUrl?: string
}

export function buildNewsArticleSchema({
  post,
  publisherName,
  publisherLogoUrl,
}: NewsArticleSchemaInput) {
  const publisher = publisherName || NEUTRAL_LABEL_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.imageUrl || undefined,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: getSiteUrl() ? `${getSiteUrl()}/news/${post.slug}` : undefined,
    publisher: {
      '@type': 'Organization',
      name: publisher,
      url: getSiteUrl() || undefined,
      ...(publisherLogoUrl
        ? {
            logo: {
              '@type': 'ImageObject',
              url: publisherLogoUrl,
            },
          }
        : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Article (press release)
// ---------------------------------------------------------------------------

export interface PressArticleSchemaInput {
  post: Pick<NewsPost, 'title' | 'publishedAt' | 'slug'>
  publisherName: string
}

export function buildPressArticleSchema({
  post,
  publisherName,
}: PressArticleSchemaInput) {
  const publisher = publisherName || NEUTRAL_LABEL_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.publishedAt,
    url: getSiteUrl() ? `${getSiteUrl()}/press/releases/${post.slug}` : undefined,
    publisher: {
      '@type': 'Organization',
      name: publisher,
      url: getSiteUrl() || undefined,
    },
  }
}
import { describe, it, expect } from 'vitest'
import {
  pageTitle,
  pageTitlePipe,
  entityTitle,
  portalPageTitle,
  portalBuilderTitle,
  rootMetadataFallbacks,
  collectLabelSocialUrls,
  buildRootLayoutMetadata,
} from '@/lib/seo/metadata'
import type { SiteSettings } from '@/types'
import { NEUTRAL_LABEL_NAME } from '@/lib/brand/tenantDefaults'

describe('seo/metadata helpers', () => {
  const brand = {
    labelName: 'Test Label',
    labelShortName: 'Test',
    contactEmail: 'label@test.local',
    siteUrl: 'https://test.local',
  }

  it('pageTitle joins page and label with em dash', () => {
    expect(pageTitle('Artists', brand.labelName)).toBe('Artists — Test Label')
  })

  it('pageTitlePipe joins page and label with pipe', () => {
    expect(pageTitlePipe('Newsletter', brand.labelShortName)).toBe('Newsletter | Test')
  })

  it('entityTitle formats entity, context, and label', () => {
    expect(entityTitle('Album', 'Artist', brand.labelName)).toBe(
      'Album — Artist | Test Label',
    )
  })

  it('portalPageTitle suffixes Portal', () => {
    expect(portalPageTitle('Invoices', brand.labelShortName)).toBe('Invoices | Test Portal')
  })

  it('portalBuilderTitle suffixes Artist Portal', () => {
    expect(portalBuilderTitle('EPK Builder', brand.labelShortName)).toBe(
      'EPK Builder | Test Artist Portal',
    )
  })

  it('collectLabelSocialUrls merges CMS social links', () => {
    const urls = collectLabelSocialUrls({
      instagramUrl: 'https://instagram.com/label',
      youtubeUrl: '',
      spotifyUrl: 'https://open.spotify.com/label',
      customSocialLinks: [
        { id: '1', label: 'Bandcamp', url: 'https://bandcamp.com/label', icon: 'bandcamp' },
      ],
    })
    expect(urls).toEqual([
      'https://instagram.com/label',
      'https://open.spotify.com/label',
      'https://bandcamp.com/label',
    ])
  })

  it('buildRootLayoutMetadata reads seo and og fields from site_settings', () => {
    const settings = {
      labelName: 'CMS Label',
      labelShortName: 'CMS',
      seoTitle: 'CMS SEO Title',
      seoDescription: 'CMS SEO Description',
      ogTitle: 'CMS OG Title',
      ogDescription: 'CMS OG Description',
      logoUrl: 'https://cdn.example/logo.png',
      faviconUrl: 'https://cdn.example/favicon.ico',
      contactEmail: 'hello@cms.local',
      instagramUrl: '',
      youtubeUrl: '',
      spotifyUrl: '',
    } as SiteSettings

    const meta = buildRootLayoutMetadata(settings)
    expect(meta.title).toBe('CMS SEO Title')
    expect(meta.description).toBe('CMS SEO Description')
    expect(meta.openGraph).toMatchObject({
      title: 'CMS OG Title',
      description: 'CMS OG Description',
      siteName: 'CMS Label',
      images: [{ url: 'https://cdn.example/logo.png', alt: 'CMS Label' }],
    })
  })

  it('rootMetadataFallbacks uses neutral brand fields', () => {
    const meta = rootMetadataFallbacks({
      labelName: NEUTRAL_LABEL_NAME,
      labelShortName: 'Music',
      contactEmail: 'label@localhost',
      siteUrl: '',
    })
    expect(meta.title).toBe(NEUTRAL_LABEL_NAME)
    expect(meta.description).toContain(NEUTRAL_LABEL_NAME)
    expect(meta.openGraph?.title).toBe(NEUTRAL_LABEL_NAME)
  })
})
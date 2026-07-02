import { describe, it, expect } from 'vitest'
import {
  pageTitle,
  pageTitlePipe,
  entityTitle,
  portalPageTitle,
  portalBuilderTitle,
  rootMetadataFallbacks,
} from '@/lib/seo/metadata'
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
import { describe, it, expect } from 'vitest'
import { deriveShortName, resolveBrandFromSettings } from '@/lib/brand'
import { NEUTRAL_LABEL_NAME } from '@/lib/brand/tenantDefaults'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

describe('deriveShortName', () => {
  it('returns first word of label name', () => {
    expect(deriveShortName('Acme Music Group')).toBe('Acme')
  })

  it('returns Label for empty input', () => {
    expect(deriveShortName('   ')).toBe('Label')
  })
})

describe('resolveBrandFromSettings', () => {
  it('uses labelShortName when set', () => {
    const brand = resolveBrandFromSettings(
      {
        ...SITE_SETTINGS_DEFAULTS,
        labelName: 'Acme Music Group',
        labelShortName: 'ACME',
      },
      'https://example.com/',
    )
    expect(brand.labelShortName).toBe('ACME')
    expect(brand.siteUrl).toBe('https://example.com')
  })

  it('derives short name when labelShortName is empty', () => {
    const brand = resolveBrandFromSettings(
      {
        ...SITE_SETTINGS_DEFAULTS,
        labelName: 'Acme Music Group',
        labelShortName: '',
      },
      'https://example.com',
    )
    expect(brand.labelShortName).toBe('Acme')
  })

  it('falls back to neutral label name from defaults', () => {
    const brand = resolveBrandFromSettings(SITE_SETTINGS_DEFAULTS)
    expect(brand.labelName).toBe(NEUTRAL_LABEL_NAME)
  })
})
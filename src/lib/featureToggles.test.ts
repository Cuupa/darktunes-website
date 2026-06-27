import { describe, expect, it } from 'vitest'
import { DEFAULT_FEATURE_TOGGLES, parseFeatureTogglesJson } from './featureToggles'

describe('parseFeatureTogglesJson', () => {
  it('returns defaults for missing or invalid JSON', () => {
    expect(parseFeatureTogglesJson(undefined)).toEqual(DEFAULT_FEATURE_TOGGLES)
    expect(parseFeatureTogglesJson('not-json')).toEqual(DEFAULT_FEATURE_TOGGLES)
  })

  it('parses known toggle keys and ignores legacy fields', () => {
    expect(
      parseFeatureTogglesJson(JSON.stringify({ promoPool: false, editorTools: true, sosStatements: false })),
    ).toEqual({ promoPool: false, editorTools: true })
  })

  it('falls back per-key when a value is not boolean', () => {
    expect(parseFeatureTogglesJson(JSON.stringify({ promoPool: 'no' }))).toEqual({
      promoPool: true,
      editorTools: true,
    })
  })
})
import { describe, it, expect } from 'vitest'
import {
  filterFieldsForType,
  mergeTypeRules,
  resolveFieldRule,
  validateTrackCount,
} from './fieldTypeRules'
import type { SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'

function makeField(overrides: Partial<SubmissionFormField> = {}): SubmissionFormField {
  return {
    id: 'f1',
    formType: 'release',
    fieldKey: 'genre',
    fieldLabels: { en: 'Genre', de: 'Genre' },
    fieldType: 'text',
    fieldScope: 'release',
    fieldGroup: null,
    fieldOptions: null,
    visibilityCondition: null,
    typeRules: null,
    validation: null,
    isRequired: false,
    isVisible: true,
    displayOrder: 1,
    placeholders: null,
    ...overrides,
  }
}

const albumRule: SubmissionReleaseTypeRule = {
  id: 'r1',
  releaseType: 'album',
  trackCountMode: 'user_specified',
  minTracks: 2,
  maxTracks: 10,
  displayOrder: 30,
}

describe('fieldTypeRules', () => {
  it('resolveFieldRule falls back to global flags', () => {
    const rule = resolveFieldRule(makeField({ isRequired: true, isVisible: true }), 'single')
    expect(rule).toEqual({ visible: true, required: true })
  })

  it('resolveFieldRule uses per-type overrides', () => {
    const rule = resolveFieldRule(
      makeField({
        typeRules: { single: { visible: false, required: false } },
      }),
      'single',
    )
    expect(rule).toEqual({ visible: false, required: false })
  })

  it('filterFieldsForType hides fields for release type', () => {
    const fields = [
      makeField({ fieldKey: 'title' }),
      makeField({
        fieldKey: 'catalog_number',
        typeRules: { single: { visible: false, required: false } },
      }),
    ]
    const visible = filterFieldsForType(fields, 'single', { type: 'single' })
    expect(visible.map((f) => f.fieldKey)).toEqual(['title'])
  })

  it('validateTrackCount enforces user-specified count', () => {
    expect(validateTrackCount(albumRule, 3, 3)).toBeNull()
    expect(validateTrackCount(albumRule, 3, 2)).toMatch(/Expected 3/)
    expect(validateTrackCount(albumRule, 1, 1)).toMatch(/between 2 and 10/)
  })

  it('mergeTypeRules patches one release type', () => {
    const merged = mergeTypeRules(null, 'album', { required: true })
    expect(merged.album).toEqual({ visible: true, required: true })
  })
})
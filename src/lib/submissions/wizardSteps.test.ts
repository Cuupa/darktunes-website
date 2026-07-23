import { describe, it, expect } from 'vitest'
import {
  buildReleaseWizardSteps,
  countCompleteTracks,
  prefillTrackFromRelease,
  applyFieldToAllTracks,
  humanizeGroupKey,
} from './wizardSteps'
import type { SubmissionFormField } from '@/types'

function field(
  partial: Partial<SubmissionFormField> & Pick<SubmissionFormField, 'fieldKey' | 'fieldScope'>,
): SubmissionFormField {
  return {
    id: partial.id ?? partial.fieldKey,
    formType: 'release',
    fieldKey: partial.fieldKey,
    fieldLabels: { en: partial.fieldKey },
    fieldType: partial.fieldType ?? 'text',
    fieldScope: partial.fieldScope,
    fieldGroup: partial.fieldGroup ?? null,
    fieldOptions: null,
    visibilityCondition: null,
    typeRules: null,
    validation: null,
    isRequired: partial.isRequired ?? false,
    isVisible: true,
    displayOrder: partial.displayOrder ?? 10,
    placeholders: null,
  }
}

describe('buildReleaseWizardSteps', () => {
  it('builds type → groups → tracks → review in known order', () => {
    const release = [
      field({ fieldKey: 'title', fieldScope: 'release', fieldGroup: 'metadata', displayOrder: 10 }),
      field({ fieldKey: 'type', fieldScope: 'release', fieldGroup: 'metadata', displayOrder: 5 }),
      field({
        fieldKey: 'cover_art_url',
        fieldScope: 'release',
        fieldGroup: 'distribution',
        displayOrder: 60,
      }),
      field({ fieldKey: 'gema_release', fieldScope: 'release', fieldGroup: 'rights', displayOrder: 90 }),
    ]
    const tracks = [field({ fieldKey: 'song_title', fieldScope: 'track', fieldGroup: 'track' })]

    const steps = buildReleaseWizardSteps(release, tracks)
    expect(steps.map((s) => s.id)).toEqual([
      'type',
      'group:metadata',
      'group:distribution',
      'group:rights',
      'tracks',
      'review',
    ])
    expect(steps.find((s) => s.id === 'group:metadata')?.fields.map((f) => f.fieldKey)).toEqual([
      'title',
    ])
    expect(steps[0]?.fields.map((f) => f.fieldKey)).toEqual(['type'])
  })

  it('omits tracks step when no track fields', () => {
    const release = [
      field({ fieldKey: 'title', fieldScope: 'release', fieldGroup: 'metadata' }),
    ]
    const steps = buildReleaseWizardSteps(release, [])
    expect(steps.map((s) => s.kind)).toEqual(['group', 'review'])
  })

  it('places custom groups after known ones by displayOrder', () => {
    const release = [
      field({ fieldKey: 'a', fieldScope: 'release', fieldGroup: 'custom_z', displayOrder: 5 }),
      field({ fieldKey: 'b', fieldScope: 'release', fieldGroup: 'metadata', displayOrder: 10 }),
    ]
    const steps = buildReleaseWizardSteps(release, [])
    expect(steps.map((s) => s.id)).toEqual(['group:metadata', 'group:custom_z', 'review'])
  })
})

describe('track helpers', () => {
  it('prefills track genre/language from release', () => {
    const trackFields = [
      field({ fieldKey: 'track_genre', fieldScope: 'track' }),
      field({ fieldKey: 'track_language', fieldScope: 'track' }),
    ]
    const out = prefillTrackFromRelease(
      { song_title: 'A', track_genre: '', track_language: '' },
      { genre: 'Techno', language: 'DE' },
      trackFields,
    )
    expect(out.track_genre).toBe('Techno')
    expect(out.track_language).toBe('DE')
  })

  it('counts complete tracks by required fields', () => {
    const trackFields = [
      field({ fieldKey: 'song_title', fieldScope: 'track', isRequired: true }),
    ]
    const n = countCompleteTracks(
      [{ values: { song_title: 'A' } }, { values: { song_title: '' } }],
      trackFields,
    )
    expect(n).toBe(1)
  })

  it('applies a field to all tracks', () => {
    const tracks = [
      { id: '1', values: { composer: 'A' } },
      { id: '2', values: { composer: 'B' } },
    ]
    const out = applyFieldToAllTracks(tracks, 'composer', 'Shared')
    expect(out.every((t) => t.values.composer === 'Shared')).toBe(true)
  })
})

describe('humanizeGroupKey', () => {
  it('title-cases snake keys', () => {
    expect(humanizeGroupKey('my_custom_group')).toBe('My Custom Group')
  })
})

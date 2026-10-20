import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/errors'
import { validateReleaseSubmissionByType } from './submissionTypeValidation'
import type { SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'

function makeField(overrides: Partial<SubmissionFormField> = {}): SubmissionFormField {
  return {
    id: 'f1',
    formType: 'release',
    fieldKey: 'title',
    fieldLabels: { en: 'Title', de: 'Titel' },
    fieldType: 'text',
    fieldScope: 'release',
    fieldGroup: null,
    fieldOptions: null,
    visibilityCondition: null,
    typeRules: null,
    validation: null,
    isRequired: true,
    isVisible: true,
    displayOrder: 1,
    placeholders: null,
    ...overrides,
  }
}

const singleRule: SubmissionReleaseTypeRule = {
  id: 'r1',
  releaseType: 'single',
  trackCountMode: 'user_specified',
  minTracks: 0,
  maxTracks: 10,
  displayOrder: 1,
}

describe('validateReleaseSubmissionByType', () => {
  it('skips required audio/cover URL fields when R2 keys are set', () => {
    expect(() =>
      validateReleaseSubmissionByType({
        releaseType: 'single',
        trackCount: 0,
        tracks: [],
        schemaFields: [
          makeField({ fieldKey: 'title' }),
          makeField({ fieldKey: 'audio_download_url', fieldType: 'url' }),
          makeField({ fieldKey: 'cover_art_url', fieldType: 'url' }),
        ],
        typeRules: [singleRule],
        standardBody: {
          title: 'Song',
          audioR2Key: 'release-submissions/a/x.wav',
          coverR2Key: 'release-submissions/a/y.jpg',
        },
        formData: {},
      }),
    ).not.toThrow()
  })

  it('still requires audio URL when no R2 key is set', () => {
    expect(() =>
      validateReleaseSubmissionByType({
        releaseType: 'single',
        trackCount: 0,
        tracks: [],
        schemaFields: [
          makeField({ fieldKey: 'title' }),
          makeField({ fieldKey: 'audio_download_url', fieldType: 'url' }),
        ],
        typeRules: [singleRule],
        standardBody: { title: 'Song' },
        formData: {},
      }),
    ).toThrow(ApiError)
  })
})

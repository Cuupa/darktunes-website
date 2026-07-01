import { describe, expect, it } from 'vitest'
import { buildTrackInsert, filterArtistTrackFields } from '@/lib/submissions/trackFieldMapping'
import type { SubmissionFormField } from '@/types'

const trackNumberField: SubmissionFormField = {
  id: '1',
  formType: 'release',
  fieldKey: 'track_number',
  fieldLabels: { en: 'Track Nr', de: 'Track-Nr.' },
  fieldType: 'number',
  fieldScope: 'track',
  fieldGroup: 'track',
  fieldOptions: null,
  visibilityCondition: null,
  typeRules: null,
  validation: null,
  isRequired: true,
  isVisible: true,
  displayOrder: 200,
  placeholders: null,
}

const songTitleField: SubmissionFormField = {
  ...trackNumberField,
  id: '2',
  fieldKey: 'song_title',
  fieldLabels: { en: 'Song Title', de: 'Songtitel' },
  fieldType: 'text',
  displayOrder: 210,
}

describe('filterArtistTrackFields', () => {
  it('removes track_number from artist-facing fields', () => {
    expect(filterArtistTrackFields([trackNumberField, songTitleField])).toEqual([songTitleField])
  })
})

describe('buildTrackInsert', () => {
  it('uses trackNumber argument and ignores track_number in field values', () => {
    const row = buildTrackInsert('sub-1', 2, 1, {
      track_number: { value: '99', fieldType: 'number' },
      song_title: { value: 'My Song', fieldType: 'text' },
    })

    expect(row.track_number).toBe(2)
    expect(row.title).toBe('My Song')
  })
})
import { ApiError } from '@/lib/errors'
import {
  filterFieldsForType,
  getTypeRuleForRelease,
  validateTrackCount,
} from '@/lib/submissions/fieldTypeRules'
import {
  getReleaseFieldValue,
  validateSchemaFields,
  validateStringField,
} from '@/lib/submissions/submissionSchemaValidation'
import { filterArtistTrackFields } from '@/lib/submissions/trackFieldMapping'
import type { SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'
import type { SubmissionReleaseType } from '@/lib/submissions/fieldTypes'

export function validateReleaseSubmissionByType(input: {
  releaseType: SubmissionReleaseType | null | undefined
  trackCount: number | undefined
  tracks: Array<{ trackNumber: number; values: Record<string, string> }>
  schemaFields: SubmissionFormField[]
  typeRules: SubmissionReleaseTypeRule[]
  standardBody: Record<string, unknown>
  formData: Record<string, unknown>
}): void {
  const releaseType = input.releaseType ?? 'single'
  const values: Record<string, string> = { type: releaseType }
  for (const field of input.schemaFields.filter((f) => f.fieldScope === 'release')) {
    const val = getReleaseFieldValue(field, input.standardBody, input.formData)
    if (typeof val === 'string') values[field.fieldKey] = val
    else if (typeof val === 'boolean') values[field.fieldKey] = val ? 'true' : 'false'
    else if (val != null) values[field.fieldKey] = String(val)
  }

  const releaseFields = filterFieldsForType(
    input.schemaFields.filter((f) => f.fieldScope === 'release'),
    releaseType,
    values,
  )
  const trackFields = filterArtistTrackFields(
    filterFieldsForType(
      input.schemaFields.filter((f) => f.fieldScope === 'track'),
      releaseType,
      values,
    ),
  )

  for (const field of releaseFields) {
    const bodyKey = field.fieldKey
    const raw = getReleaseFieldValue(field, input.standardBody, input.formData)
    if (typeof raw === 'string') {
      validateStringField(field.fieldType, raw, bodyKey)
    }
  }

  validateSchemaFields(releaseFields, (field) =>
    getReleaseFieldValue(field, input.standardBody, input.formData),
  )

  const typeRule = getTypeRuleForRelease(input.typeRules, releaseType)
  const trackCountError = validateTrackCount(typeRule, input.trackCount, input.tracks.length)
  if (trackCountError) {
    throw new ApiError(400, trackCountError)
  }

  if (trackFields.length === 0 && input.tracks.length > 0) {
    throw new ApiError(400, 'Tracks are not allowed for this release type')
  }

  for (const track of input.tracks) {
    for (const field of trackFields) {
      const raw = track.values[field.fieldKey] ?? ''
      if (field.isRequired && !raw.trim() && field.fieldType !== 'boolean') {
        throw new ApiError(400, `Required track field missing: ${field.fieldKey} (track ${track.trackNumber})`)
      }
      validateStringField(field.fieldType, raw, `${field.fieldKey} (track ${track.trackNumber})`)
    }
  }

  if (input.tracks.length === 0 && trackFields.some((f) => f.isRequired)) {
    throw new ApiError(400, 'At least one track is required')
  }
}
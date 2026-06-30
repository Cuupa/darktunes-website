import { ApiError } from '@/lib/errors'
import { normalizeFieldValue, parseDateDmyToIso, validateFieldValue } from '@/lib/submissions/fieldValidation'
import { RELEASE_STANDARD_FIELD_TO_BODY_KEY } from '@/lib/submissions/releaseFieldMapping'
import type { SubmissionFieldType } from '@/lib/submissions/fieldTypes'
import type { SubmissionFormField } from '@/types'

export { RELEASE_STANDARD_FIELD_TO_BODY_KEY } from '@/lib/submissions/releaseFieldMapping'

export function getReleaseFieldValue(
  field: SubmissionFormField,
  standardBody: Record<string, unknown>,
  formData: Record<string, unknown>,
): unknown {
  const bodyKey = RELEASE_STANDARD_FIELD_TO_BODY_KEY[field.fieldKey]
  if (bodyKey !== undefined) return standardBody[bodyKey]
  return formData[field.fieldKey]
}

export function validateSchemaFields(
  fields: SubmissionFormField[],
  getValue: (field: SubmissionFormField) => unknown,
): void {
  for (const field of fields) {
    if (!field.isRequired) continue
    const raw = getValue(field)
    if (raw === undefined || raw === null || raw === '') {
      throw new ApiError(400, `Required field missing: ${field.fieldKey}`)
    }
    if (typeof raw === 'string' && field.fieldType !== 'boolean') {
      const err = validateFieldValue(field.fieldType, raw)
      if (err) throw new ApiError(400, `${field.fieldKey}: ${err}`)
    }
  }
}

export function validateStringField(fieldType: SubmissionFieldType, value: string, fieldKey: string): void {
  if (!value.trim()) return
  const err = validateFieldValue(fieldType, value)
  if (err) throw new ApiError(400, `${fieldKey}: ${err}`)
}

export function coerceReleaseDate(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return parseDateDmyToIso(value)
}

export function stringFieldToStorage(field: SubmissionFormField, value: string): unknown {
  if (!value.trim()) return null
  return normalizeFieldValue(field.fieldType, value)
}
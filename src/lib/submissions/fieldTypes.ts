export const SUBMISSION_FIELD_TYPES = [
  'text',
  'url',
  'date',
  'date_dmy',
  'select',
  'textarea',
  'boolean',
  'number',
  'year',
  'ean',
  'isrc',
  'duration',
  'seconds',
  'email',
] as const

export type SubmissionFieldType = (typeof SUBMISSION_FIELD_TYPES)[number]

export const SUBMISSION_FIELD_SCOPES = ['release', 'track'] as const
export type SubmissionFieldScope = (typeof SUBMISSION_FIELD_SCOPES)[number]

export type VisibilityOperator = 'eq' | 'neq' | 'in'

export interface VisibilityCondition {
  field: string
  op: VisibilityOperator
  value: string | string[]
}

export interface SelectOption {
  value: string
  labels: Record<string, string>
}

export const SUBMISSION_RELEASE_TYPES = ['single', 'ep', 'album', 'compilation'] as const
export type SubmissionReleaseType = (typeof SUBMISSION_RELEASE_TYPES)[number]

export const TRACK_COUNT_MODES = ['fixed_1', 'user_specified'] as const
export type TrackCountMode = (typeof TRACK_COUNT_MODES)[number]

export interface TypeFieldRule {
  visible: boolean
  required: boolean
}

export type FieldTypeRules = Partial<Record<SubmissionReleaseType, TypeFieldRule>>
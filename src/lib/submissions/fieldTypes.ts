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
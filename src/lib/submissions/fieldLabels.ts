import { routing } from '@/i18n/routing'
import type { SubmissionFormField } from '@/types'

export function getFieldLabel(field: SubmissionFormField, locale: string): string {
  return (
    field.fieldLabels[locale]
    ?? field.fieldLabels[routing.defaultLocale]
    ?? field.fieldLabels.en
    ?? Object.values(field.fieldLabels)[0]
    ?? field.fieldKey
  )
}

export function getFieldPlaceholder(field: SubmissionFormField, locale: string): string {
  if (!field.placeholders) return ''
  return (
    field.placeholders[locale]
    ?? field.placeholders[routing.defaultLocale]
    ?? field.placeholders.en
    ?? ''
  )
}
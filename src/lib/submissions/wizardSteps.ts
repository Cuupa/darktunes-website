/**
 * Build schema-driven wizard steps for the portal release submission form.
 * Steps are derived from field_group + field_scope — not hard-coded field keys
 * (except the bookend steps: type, tracks, review).
 */

import type { SubmissionFormField } from '@/types'
import type { SubmissionReleaseType } from '@/lib/submissions/fieldTypes'

export type WizardStepKind = 'type' | 'group' | 'tracks' | 'review'

export interface WizardStep {
  id: string
  kind: WizardStepKind
  /** field_group key when kind === 'group' */
  groupKey?: string
  /** Release-scope fields shown on this step (empty for tracks/review) */
  fields: SubmissionFormField[]
  /** Translation key suffix under portal.* (e.g. submission_wizard_step_metadata) */
  titleKey: string
  descriptionKey: string
}

/** Preferred order for well-known groups; others sort by min displayOrder. */
const KNOWN_GROUP_ORDER = ['metadata', 'distribution', 'rights'] as const

/** Field keys that belong only on the type step (not repeated in groups). */
export const TYPE_STEP_FIELD_KEYS = new Set(['type'])

export function humanizeGroupKey(groupKey: string): string {
  return groupKey
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function groupTitleKey(groupKey: string): string {
  if ((KNOWN_GROUP_ORDER as readonly string[]).includes(groupKey)) {
    return `submission_wizard_step_${groupKey}`
  }
  return 'submission_wizard_step_custom'
}

function groupDescriptionKey(groupKey: string): string {
  if ((KNOWN_GROUP_ORDER as readonly string[]).includes(groupKey)) {
    return `submission_wizard_step_${groupKey}_desc`
  }
  return 'submission_wizard_step_custom_desc'
}

/**
 * Partition visible release fields into ordered wizard steps.
 *
 * @param releaseFields - already filtered by type / visibility
 * @param trackFields - already filtered track fields (presence drives tracks step)
 * @param options.includeTypeStep - when type field is present (or always for track count UX)
 */
export function buildReleaseWizardSteps(
  releaseFields: SubmissionFormField[],
  trackFields: SubmissionFormField[],
  options?: {
    /** Force type step even if `type` field is hidden (for track-count UX). Default true when type present. */
    forceTypeStep?: boolean
  },
): WizardStep[] {
  const steps: WizardStep[] = []
  const typeField = releaseFields.find((f) => f.fieldKey === 'type')
  const includeTypeStep = options?.forceTypeStep === true || typeField != null

  if (includeTypeStep) {
    steps.push({
      id: 'type',
      kind: 'type',
      fields: typeField ? [typeField] : [],
      titleKey: 'submission_wizard_step_type',
      descriptionKey: 'submission_wizard_step_type_desc',
    })
  }

  const groupFields = releaseFields.filter((f) => !TYPE_STEP_FIELD_KEYS.has(f.fieldKey))
  const byGroup = new Map<string, SubmissionFormField[]>()

  for (const field of groupFields) {
    const key = field.fieldGroup?.trim() || 'other'
    const list = byGroup.get(key) ?? []
    list.push(field)
    byGroup.set(key, list)
  }

  for (const list of byGroup.values()) {
    list.sort((a, b) => a.displayOrder - b.displayOrder)
  }

  const groupKeys = [...byGroup.keys()]
  groupKeys.sort((a, b) => {
    const ai = KNOWN_GROUP_ORDER.indexOf(a as (typeof KNOWN_GROUP_ORDER)[number])
    const bi = KNOWN_GROUP_ORDER.indexOf(b as (typeof KNOWN_GROUP_ORDER)[number])
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    const aMin = Math.min(...(byGroup.get(a) ?? []).map((f) => f.displayOrder))
    const bMin = Math.min(...(byGroup.get(b) ?? []).map((f) => f.displayOrder))
    return aMin - bMin || a.localeCompare(b)
  })

  for (const groupKey of groupKeys) {
    const fields = byGroup.get(groupKey) ?? []
    if (fields.length === 0) continue
    steps.push({
      id: `group:${groupKey}`,
      kind: 'group',
      groupKey,
      fields,
      titleKey: groupTitleKey(groupKey),
      descriptionKey: groupDescriptionKey(groupKey),
    })
  }

  if (trackFields.length > 0) {
    steps.push({
      id: 'tracks',
      kind: 'tracks',
      fields: [],
      titleKey: 'submission_wizard_step_tracks',
      descriptionKey: 'submission_wizard_step_tracks_desc',
    })
  }

  steps.push({
    id: 'review',
    kind: 'review',
    fields: [],
    titleKey: 'submission_wizard_step_review',
    descriptionKey: 'submission_wizard_step_review_desc',
  })

  return steps
}

export function stepIndexById(steps: WizardStep[], id: string): number {
  return steps.findIndex((s) => s.id === id)
}

/** Whether a release-scope field has a non-empty value for required checks. */
export function isFieldFilled(field: SubmissionFormField, raw: string | undefined): boolean {
  if (field.fieldType === 'boolean') return true
  return Boolean((raw ?? '').trim())
}

export function validateStepFields(
  fields: SubmissionFormField[],
  values: Record<string, string>,
  validateValue: (fieldType: SubmissionFormField['fieldType'], raw: string) => string | null,
  requiredMessage: string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const raw = values[field.fieldKey] ?? ''
    if (field.isRequired && !isFieldFilled(field, raw)) {
      errors[field.fieldKey] = requiredMessage
    } else if (raw.trim()) {
      const err = validateValue(field.fieldType, raw)
      if (err) errors[field.fieldKey] = err
    }
  }
  return errors
}

export function isTrackRowComplete(
  trackValues: Record<string, string>,
  trackFields: SubmissionFormField[],
): boolean {
  return trackFields.every((field) => {
    if (!field.isRequired) return true
    return isFieldFilled(field, trackValues[field.fieldKey])
  })
}

export function countCompleteTracks(
  tracks: Array<{ values: Record<string, string> }>,
  trackFields: SubmissionFormField[],
): number {
  return tracks.filter((tr) => isTrackRowComplete(tr.values, trackFields)).length
}

/** Prefill track genre/language from release-level fields when track field empty. */
export function prefillTrackFromRelease(
  trackValues: Record<string, string>,
  releaseValues: Record<string, string>,
  trackFields: SubmissionFormField[],
): Record<string, string> {
  const next = { ...trackValues }
  const map: Array<[string, string]> = [
    ['track_genre', 'genre'],
    ['track_language', 'language'],
  ]
  for (const [trackKey, releaseKey] of map) {
    if (!trackFields.some((f) => f.fieldKey === trackKey)) continue
    if (!(next[trackKey] ?? '').trim() && (releaseValues[releaseKey] ?? '').trim()) {
      next[trackKey] = releaseValues[releaseKey]!
    }
  }
  return next
}

export function copyTrackValues(
  source: Record<string, string>,
  target: Record<string, string>,
  keys: string[],
): Record<string, string> {
  const next = { ...target }
  for (const key of keys) {
    if (source[key] !== undefined) next[key] = source[key]!
  }
  return next
}

export function applyFieldToAllTracks(
  tracks: Array<{ id: string; values: Record<string, string> }>,
  fieldKey: string,
  value: string,
): Array<{ id: string; values: Record<string, string> }> {
  return tracks.map((tr) => ({
    ...tr,
    values: { ...tr.values, [fieldKey]: value },
  }))
}

export type { SubmissionReleaseType }

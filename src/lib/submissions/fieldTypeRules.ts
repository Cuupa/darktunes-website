import type {
  FieldTypeRules,
  SubmissionReleaseType,
  TypeFieldRule,
} from '@/lib/submissions/fieldTypes'
import { isFieldVisible } from '@/lib/submissions/visibilityCondition'
import type { SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'

export interface ResolvedFieldRule {
  visible: boolean
  required: boolean
}

export function resolveFieldRule(
  field: Pick<SubmissionFormField, 'isVisible' | 'isRequired' | 'typeRules'>,
  releaseType: SubmissionReleaseType,
): ResolvedFieldRule {
  if (!field.isVisible) {
    return { visible: false, required: false }
  }

  const typeRule = field.typeRules?.[releaseType]
  return {
    visible: typeRule?.visible ?? field.isVisible,
    required: typeRule?.required ?? field.isRequired,
  }
}

export function isFieldActiveForType(
  field: SubmissionFormField,
  releaseType: SubmissionReleaseType,
  values: Record<string, string>,
): boolean {
  const { visible } = resolveFieldRule(field, releaseType)
  if (!visible) return false
  return isFieldVisible(field.visibilityCondition, values)
}

export function filterFieldsForType(
  fields: SubmissionFormField[],
  releaseType: SubmissionReleaseType,
  values: Record<string, string>,
): SubmissionFormField[] {
  return fields
    .filter((field) => isFieldActiveForType(field, releaseType, values))
    .map((field) => {
      const rule = resolveFieldRule(field, releaseType)
      return { ...field, isRequired: rule.required, isVisible: rule.visible }
    })
}

export function getTypeRuleForRelease(
  rules: SubmissionReleaseTypeRule[],
  releaseType: SubmissionReleaseType,
): SubmissionReleaseTypeRule | undefined {
  return rules.find((rule) => rule.releaseType === releaseType)
}

export function expectedTrackCount(
  typeRule: SubmissionReleaseTypeRule | undefined,
  trackCount: number | undefined,
): number {
  if (!typeRule || typeRule.trackCountMode === 'fixed_1') return 1
  return trackCount ?? typeRule.minTracks
}

export function validateTrackCount(
  typeRule: SubmissionReleaseTypeRule | undefined,
  trackCount: number | undefined,
  actualTracks: number,
): string | null {
  if (!typeRule) {
    return actualTracks < 1 ? 'At least one track is required' : null
  }

  if (typeRule.trackCountMode === 'fixed_1') {
    return actualTracks === 1 ? null : 'Single releases must have exactly one track'
  }

  if (trackCount == null || !Number.isInteger(trackCount)) {
    return 'Track count is required'
  }

  if (trackCount < typeRule.minTracks || trackCount > typeRule.maxTracks) {
    return `Track count must be between ${typeRule.minTracks} and ${typeRule.maxTracks}`
  }

  if (actualTracks !== trackCount) {
    return `Expected ${trackCount} track(s), got ${actualTracks}`
  }

  return null
}

export function defaultTypeRules(): FieldTypeRules {
  return {
    single: { visible: true, required: false },
    ep: { visible: true, required: false },
    album: { visible: true, required: false },
    compilation: { visible: true, required: false },
  }
}

export function mergeTypeRules(
  existing: FieldTypeRules | null | undefined,
  releaseType: SubmissionReleaseType,
  patch: Partial<TypeFieldRule>,
): FieldTypeRules {
  const current = existing ?? defaultTypeRules()
  const prev = current[releaseType] ?? { visible: true, required: false }
  return {
    ...current,
    [releaseType]: { ...prev, ...patch },
  }
}
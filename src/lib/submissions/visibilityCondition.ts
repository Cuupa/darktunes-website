import type { VisibilityCondition } from '@/lib/submissions/fieldTypes'

export function isFieldVisible(
  condition: VisibilityCondition | null | undefined,
  values: Record<string, string>,
): boolean {
  if (!condition) return true
  const current = values[condition.field] ?? ''
  switch (condition.op) {
    case 'eq':
      return current === condition.value
    case 'neq':
      return current !== condition.value
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(current)
    default:
      return true
  }
}
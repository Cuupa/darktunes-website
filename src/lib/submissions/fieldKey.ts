import { toSlug } from '@/lib/slugify'

/** Derives a stable snake_case field key from a human-readable label. */
export function fieldKeyFromLabel(label: string): string {
  return toSlug(label).replace(/-/g, '_')
}

export function uniqueFieldKey(baseKey: string, existingKeys: Set<string>): string {
  if (!existingKeys.has(baseKey)) return baseKey
  let n = 2
  while (existingKeys.has(`${baseKey}_${n}`)) n++
  return `${baseKey}_${n}`
}
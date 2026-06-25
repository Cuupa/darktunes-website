import type { Dictionary } from './types'

export type PortalMessageKey = keyof Dictionary['portal']

/** Type-safe bridge for dynamic portal message keys (nav groups, analytics tabs, EPK sections). */
export function translatePortalKey(
  t: (key: PortalMessageKey, values?: Record<string, string | number | Date>) => string,
  key: PortalMessageKey | string,
): string {
  return t(key as PortalMessageKey)
}
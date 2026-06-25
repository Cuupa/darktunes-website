import type { PortalDictionary } from './types'

/** Cast dynamic portal message keys for next-intl `t()` calls. */
export type PortalMessageKey = keyof PortalDictionary

export function portalKey(key: string): PortalMessageKey {
  return key as PortalMessageKey
}
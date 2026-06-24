import {
  ANALYTICS_TAB_IDS,
  DEFAULT_VISIBLE_TABS,
  PORTAL_ANALYTICS_VIEW_STORAGE_KEY,
  type AnalyticsTabId,
} from './constants'

export type TabVisibility = Record<AnalyticsTabId, boolean>

export function getDefaultTabVisibility(): TabVisibility {
  return { ...DEFAULT_VISIBLE_TABS }
}

export function loadTabVisibility(storageKey: string): TabVisibility {
  if (typeof window === 'undefined') return getDefaultTabVisibility()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return getDefaultTabVisibility()
    const parsed = JSON.parse(raw) as Partial<TabVisibility>
    const merged = getDefaultTabVisibility()
    for (const id of ANALYTICS_TAB_IDS) {
      if (typeof parsed[id] === 'boolean') merged[id] = parsed[id]!
    }
    return merged
  } catch {
    return getDefaultTabVisibility()
  }
}

export function saveTabVisibility(storageKey: string, visibility: TabVisibility): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(visibility))
}

export function visibleTabIds(visibility: TabVisibility): AnalyticsTabId[] {
  return ANALYTICS_TAB_IDS.filter((id) => visibility[id])
}

export { PORTAL_ANALYTICS_VIEW_STORAGE_KEY }
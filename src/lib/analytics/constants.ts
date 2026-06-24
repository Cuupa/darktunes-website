/** Shared analytics thresholds — single source of truth (no magic numbers in UI). */

export const EVENT_IMPACT_WINDOW_DAYS = 30

export const TREND_MIN_PERIODS = 3
export const GROWTH_SIGNIFICANT_PCT = 10
export const CORRELATION_STRONG_THRESHOLD = 0.6
export const ANOMALY_Z_SCORE_THRESHOLD = 2

export const DEFAULT_INVOICE_DUE_DAYS = 14
export const DEFAULT_TAX_RATE_PCT = 19

export const PORTAL_ANALYTICS_VIEW_STORAGE_KEY = 'portal-analytics-view-v1'
export const ADMIN_ANALYTICS_VIEW_STORAGE_KEY = 'admin-analytics-view-v1'

export const ANALYTICS_TAB_IDS = [
  'streaming',
  'listeners',
  'territories',
  'events',
  'earnings',
  'releases',
  'revenue-mix',
  'press',
  'settlement',
  'engagement',
  'merch',
] as const

export type AnalyticsTabId = (typeof ANALYTICS_TAB_IDS)[number]

export const DEFAULT_VISIBLE_TABS: Record<AnalyticsTabId, boolean> = {
  streaming: true,
  listeners: true,
  territories: true,
  events: true,
  earnings: true,
  releases: true,
  'revenue-mix': true,
  press: true,
  settlement: true,
  engagement: true,
  merch: true,
}
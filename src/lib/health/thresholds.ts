/**
 * src/lib/health/thresholds.ts
 *
 * SLA and monitoring thresholds for enterprise health dashboard.
 */

/** How far back to query sync_logs for latest-per-API and 24h stats. */
export const HEALTH_LOG_LOOKBACK_MS = 48 * 60 * 60 * 1000

/** Cap rows fetched — prevents unbounded reads on high-volume deployments. */
export const HEALTH_LOG_FETCH_LIMIT = 1000

/** Database round-trip latency (ms) above which status is degraded. */
export const DB_LATENCY_WARN_MS = 500

/** Database round-trip latency (ms) above which status is critical. */
export const DB_LATENCY_CRITICAL_MS = 2000

/** Minimum 24h runs before success-rate SLA alerts apply. */
export const MIN_RUNS_FOR_SLA = 3

/** 24h success rate (%) below which a warning is raised. */
export const SLA_SUCCESS_RATE_WARN = 80

/** 24h success rate (%) below which a critical alert is raised. */
export const SLA_SUCCESS_RATE_CRITICAL = 50

/** Sync queue pending jobs above which backlog warning fires. */
export const QUEUE_BACKLOG_WARN = 50

/** Health score deductions (0–100 scale). */
export const SCORE_DB_OFFLINE = 100
export const SCORE_DB_CRITICAL_LATENCY = 25
export const SCORE_DB_WARN_LATENCY = 10
export const SCORE_API_FAILING = 15
export const SCORE_API_DEGRADED = 8
export const SCORE_API_STALE = 6
export const SCORE_QUEUE_FAILING = 20
export const SCORE_QUEUE_DEGRADED = 10
export const SCORE_SLA_CRITICAL = 15
export const SCORE_SLA_WARN = 5

/** Expected interval for `/api/sync` (Vercel cron: every 5 minutes). */
export const CRON_EXECUTE_INTERVAL_MS = 5 * 60 * 1000

/** Alert when execute cron has not fired within this window (3 missed runs). */
export const CRON_EXECUTE_MISSED_MS = 15 * 60 * 1000

/** Daily cron jobs (queue enqueue, YouTube) — stale after 36 hours. */
export const CRON_DAILY_STALE_MS = 36 * 60 * 60 * 1000

/** Minimum cooldown between identical critical alert bundles (email/webhook). */
export const HEALTH_ALERT_COOLDOWN_MS = 30 * 60 * 1000

/** Alert checker cron interval (documented; used for self-heartbeat grace). */
export const HEALTH_ALERT_INTERVAL_MS = 10 * 60 * 1000
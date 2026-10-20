import type { HealthAlert } from '@/lib/health/types'

export interface WatchLogRow {
  fingerprint: string | null
  occurrences: number
  first_seen_at: string
  last_seen_at: string
  source: string
  message: string
  http_status: number | null
  app_version: string | null
}

export function evaluateWatchRules(input: {
  nowMs: number
  appVersion: string
  logs: WatchLogRow[]
  failedSyncJobs: number
  uploadFailures: number
  serverErrors: number
}): HealthAlert[] {
  const alerts: HealthAlert[] = []
  const hourAgo = input.nowMs - 60 * 60 * 1000
  const dayAgo = input.nowMs - 24 * 60 * 60 * 1000

  const newAfterDeploy = input.logs.filter((row) => {
    if (!row.fingerprint || row.app_version !== input.appVersion) return false
    return new Date(row.first_seen_at).getTime() >= dayAgo
  })
  if (newAfterDeploy.length >= 3) {
    alerts.push({
      id: 'ai-watch-new-after-deploy',
      severity: 'warning',
      title: 'New errors after this deployment',
      message: `${newAfterDeploy.length} fingerprints first appeared on app version ${input.appVersion}.`,
      source: 'system',
    })
  }

  const spikes = input.logs.filter(
    (row) => row.occurrences >= 8 && new Date(row.last_seen_at).getTime() >= hourAgo,
  )
  if (spikes.length > 0) {
    alerts.push({
      id: 'ai-watch-fingerprint-spike',
      severity: 'warning',
      title: 'Repeated error fingerprint',
      message: `${spikes.length} fingerprint(s) fired at least 8 times, last seen within an hour.`,
      source: 'system',
    })
  }

  if (input.failedSyncJobs >= 3) {
    alerts.push({
      id: 'ai-watch-failed-sync',
      severity: 'warning',
      title: 'Sync jobs failing',
      message: `${input.failedSyncJobs} sync jobs are in failed state.`,
      source: 'sync_queue',
    })
  }

  if (input.serverErrors >= 20) {
    alerts.push({
      id: 'ai-watch-500-burst',
      severity: 'critical',
      title: 'Many server errors',
      message: `${input.serverErrors} error-level app_logs rows were seen in the watch window.`,
      source: 'system',
    })
  }

  if (input.uploadFailures >= 5) {
    alerts.push({
      id: 'ai-watch-uploads',
      severity: 'warning',
      title: 'Repeated upload failures',
      message: `${input.uploadFailures} recent log rows look like upload or storage failures.`,
      source: 'system',
    })
  }

  return alerts
}

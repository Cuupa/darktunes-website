/**
 * Maps sync/cron failure signals to short, actionable admin messages.
 * Keep copy plain — no stack traces, no internal jargon without a next step.
 */

export interface UserFacingError {
  title: string
  message: string
  fixHint: string | null
}

export function describeSyncQueueIssue(input: {
  executorNeverRan: boolean
  executorOffline: boolean
  backlog: number
  youtubeUnconfigured: boolean
  youtubeIdle: boolean
  cronSecretMissing: boolean
}): UserFacingError[] {
  const out: UserFacingError[] = []

  if (input.cronSecretMissing) {
    out.push({
      title: 'Cron auth not configured',
      message: 'CRON_SECRET is missing on the site. Supabase Cron cannot call sync routes securely.',
      fixHint: 'Set CRON_SECRET in Vercel and the same value on the trigger-sync Edge Function secrets.',
    })
  }

  if (input.executorNeverRan && input.backlog > 0) {
    out.push({
      title: 'Executor never ran',
      message: `${input.backlog} job(s) are waiting, but /api/sync has no heartbeat yet.`,
      fixHint:
        'In Supabase, schedule Cron type=process-queue every 5 minutes to trigger-sync, and confirm SITE_URL + CRON_SECRET on the Edge Function.',
    })
  } else if (input.executorOffline && input.backlog > 0) {
    out.push({
      title: 'Executor offline',
      message: `${input.backlog} job(s) are waiting and the executor heartbeat is stale.`,
      fixHint:
        'Check Supabase Cron last run for process-queue. Verify Edge secrets SITE_URL (production URL) and CRON_SECRET match Vercel.',
    })
  }

  if (input.youtubeUnconfigured) {
    out.push({
      title: 'YouTube not configured',
      message: 'Channel video sync needs an API key and channel ID.',
      fixHint: 'Add youtube_api_key and youtube_channel_id under Admin → API Keys.',
    })
  } else if (input.youtubeIdle) {
    out.push({
      title: 'YouTube sync never ran',
      message: 'No YouTube heartbeat yet — daily channel sync has not completed.',
      fixHint:
        'Schedule Supabase Cron type=youtube (daily) or run Sync YouTube from this page after credentials are set.',
    })
  }

  return out
}

export function describeJobError(errorMessage: string | null): string {
  if (!errorMessage) return 'No error details.'
  const msg = errorMessage.trim()
  if (msg.includes('Rate limited') || msg.includes('429')) {
    return 'Provider rate-limited this job. It was rescheduled with a cooldown (not retried in a tight loop).'
  }
  if (msg.includes('quota') || msg.includes('YOUTUBE_QUOTA')) {
    return 'YouTube API quota is exhausted for today. Wait for quota reset or raise the Google Cloud quota.'
  }
  if (msg.includes('CRON_SECRET') || msg.includes('Unauthorized') || msg.includes('401')) {
    return 'Authentication failed. CRON_SECRET in Vercel and the Edge Function must match.'
  }
  if (msg.includes('Cancelled by admin') || msg.includes('Cancel requested')) {
    return 'Cancelled from the Advanced job console.'
  }
  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg
}

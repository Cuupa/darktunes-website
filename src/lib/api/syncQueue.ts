/**
 * src/lib/api/syncQueue.ts — Sync Queue DAL
 *
 * Provides read/write access to the sync_queue table.
 *
 * The sync queue decouples triggering a sync (POST /api/sync) from the actual
 * processing, so syncing many artists never exceeds Vercel's timeout limits.
 * Each job processes one artist via POST /api/process-sync-queue (cron: every
 * 5 minutes).
 *
 * Job lifecycle:
 *   pending → running → done
 *                     → failed (attempt_count incremented, re-queued up to 3×)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type SyncQueueRow = Database['public']['Tables']['sync_queue']['Row']

export type SyncJobType = 'full' | 'spotify' | 'discogs' | 'youtube'
export type SyncJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface SyncJob {
  id: string
  artistId: string | null
  jobType: SyncJobType
  status: SyncJobStatus
  scheduledAt: string
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  attemptCount: number
  createdAt: string
}

export const MAX_ATTEMPTS = 3

function rowToSyncJob(row: SyncQueueRow): SyncJob {
  return {
    id: row.id,
    artistId: row.artist_id ?? null,
    jobType: (row.job_type as SyncJobType) ?? 'full',
    status: row.status as SyncJobStatus,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    errorMessage: row.error_message ?? null,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
  }
}

/**
 * Enqueue sync jobs for all artists.
 * Skips artists that already have a pending or running job to avoid duplicates.
 * Returns the number of jobs enqueued.
 */
export async function enqueueArtistSyncJobs(
  db: DbClient,
  artistIds: string[],
  jobType: SyncJobType = 'full',
): Promise<number> {
  if (artistIds.length === 0) return 0

  // Find artists already queued (pending or running) to avoid duplicates
  const { data: existing } = await db
    .from('sync_queue')
    .select('artist_id')
    .in('artist_id', artistIds)
    .in('status', ['pending', 'running'])

  const alreadyQueued = new Set((existing ?? []).map((r) => r.artist_id))
  const toEnqueue = artistIds.filter((id) => !alreadyQueued.has(id))

  if (toEnqueue.length === 0) return 0

  const jobs = toEnqueue.map((artistId) => ({
    artist_id: artistId,
    job_type: jobType,
    status: 'pending' as const,
  }))

  const { error } = await db.from('sync_queue').insert(jobs)
  if (error) throw new Error(`Failed to enqueue sync jobs: ${error.message}`)

  return toEnqueue.length
}

/**
 * Claim the oldest pending job by setting it to 'running'.
 * Returns null if no pending jobs are available.
 *
 * Uses a single UPDATE with RETURNING to atomically claim the job — avoids
 * race conditions when multiple cron instances run concurrently.
 */
export async function claimNextSyncJob(db: DbClient): Promise<SyncJob | null> {
  // Find the oldest pending job that hasn't exceeded max attempts
  const { data: candidates } = await db
    .from('sync_queue')
    .select('id')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (!candidates || candidates.length === 0) return null

  const jobId = candidates[0].id

  const { data, error } = await db
    .from('sync_queue')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      // attempt_count is incremented separately below
    })
    .eq('id', jobId)
    .eq('status', 'pending') // optimistic lock — prevent double-claim
    .select()
    .single()

  if (error || !data) return null

  // Increment attempt_count separately (Supabase PostgREST doesn't support col + 1 in update)
  await db
    .from('sync_queue')
    .update({ attempt_count: (data.attempt_count ?? 0) + 1 })
    .eq('id', jobId)

  return rowToSyncJob({ ...data, attempt_count: (data.attempt_count ?? 0) + 1 })
}

/**
 * Mark a job as done.
 */
export async function markSyncJobDone(db: DbClient, jobId: string): Promise<void> {
  const { error } = await db
    .from('sync_queue')
    .update({ status: 'done', finished_at: new Date().toISOString() })
    .eq('id', jobId)

  if (error) throw new Error(`Failed to mark job done: ${error.message}`)
}

/**
 * Mark a job as failed with an error message.
 * If attempt_count < MAX_ATTEMPTS, resets status to 'pending' with exponential
 * backoff (scheduled_at is pushed forward) so the cron retries it.
 */
export async function markSyncJobFailed(
  db: DbClient,
  jobId: string,
  errorMessage: string,
  currentAttemptCount: number,
): Promise<void> {
  const willRetry = currentAttemptCount < MAX_ATTEMPTS

  // Exponential backoff: 2^attempt minutes (2, 4, 8 minutes)
  const backoffMinutes = Math.pow(2, currentAttemptCount)
  const scheduledAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()

  const { error } = await db
    .from('sync_queue')
    .update({
      status: willRetry ? 'pending' : 'failed',
      finished_at: willRetry ? null : new Date().toISOString(),
      error_message: errorMessage,
      ...(willRetry ? { scheduled_at: scheduledAt } : {}),
    })
    .eq('id', jobId)

  if (error) throw new Error(`Failed to mark job failed: ${error.message}`)
}

/**
 * Get recent queue status for the Admin Health dashboard.
 */
export async function getSyncQueueStats(
  db: DbClient,
): Promise<{ pending: number; running: number; done: number; failed: number }> {
  const { data, error } = await db
    .from('sync_queue')
    .select('status')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (error) throw new Error(`Failed to get sync queue stats: ${error.message}`)

  const counts = { pending: 0, running: 0, done: 0, failed: 0 }
  for (const row of data ?? []) {
    const s = row.status as SyncJobStatus
    if (s in counts) counts[s]++
  }
  return counts
}

/**
 * Get recent sync jobs for display in the Admin Health tab.
 */
export async function getRecentSyncJobs(db: DbClient, limit = 20): Promise<SyncJob[]> {
  const { data, error } = await db
    .from('sync_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Failed to get sync jobs: ${error.message}`)
  return (data ?? []).map(rowToSyncJob)
}

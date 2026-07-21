/**
 * Client helper: poll sync queue stats and re-kick the executor until idle
 * or timeout. Used by admin hooks after enqueue so the UI reloads with
 * actual DB results instead of the pre-sync snapshot.
 */

export interface SyncQueueStats {
  pending: number
  running: number
  done: number
  failed: number
}

export interface WaitForSyncQueueOptions {
  accessToken: string
  /** Max time to wait for pending+running to reach 0. Default 90s. */
  timeoutMs?: number
  /** Delay between poll/execute kicks. Default 3s. */
  pollIntervalMs?: number
  /** Called after each stats poll with active job count. */
  onProgress?: (active: number, stats: SyncQueueStats) => void
  fetchImpl?: typeof fetch
}

export interface WaitForSyncQueueResult {
  drained: boolean
  stats: SyncQueueStats
  waitedMs: number
}

const DEFAULT_TIMEOUT_MS = 90_000
const DEFAULT_POLL_MS = 3_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchQueueStats(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<SyncQueueStats> {
  const res = await fetchImpl('/api/sync/queue', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Queue stats failed: ${text.slice(0, 200) || res.status}`)
  }
  const data = (await res.json()) as Partial<SyncQueueStats>
  return {
    pending: data.pending ?? 0,
    running: data.running ?? 0,
    done: data.done ?? 0,
    failed: data.failed ?? 0,
  }
}

async function kickExecutor(
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const res = await fetchImpl('/api/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  // Executor returns 200 { accepted: true }; non-OK is non-fatal during poll.
  if (!res.ok) {
    // Drain the body so the connection can close cleanly.
    await res.text().catch(() => undefined)
  }
}

/**
 * Polls until the sync queue has no pending/running jobs, re-kicking the
 * background executor each cycle so large queues do not wait for the 5-minute
 * cron. Returns when drained or when timeoutMs elapses.
 */
export async function waitForSyncQueueIdle(
  options: WaitForSyncQueueOptions,
): Promise<WaitForSyncQueueResult> {
  const {
    accessToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_MS,
    onProgress,
    fetchImpl = globalThis.fetch,
  } = options

  const started = Date.now()
  let stats = await fetchQueueStats(accessToken, fetchImpl)
  onProgress?.(stats.pending + stats.running, stats)

  if (stats.pending + stats.running === 0) {
    return { drained: true, stats, waitedMs: 0 }
  }

  while (Date.now() - started < timeoutMs) {
    await kickExecutor(accessToken, fetchImpl)
    await sleep(pollIntervalMs)
    stats = await fetchQueueStats(accessToken, fetchImpl)
    const active = stats.pending + stats.running
    onProgress?.(active, stats)
    if (active === 0) {
      return { drained: true, stats, waitedMs: Date.now() - started }
    }
  }

  return { drained: false, stats, waitedMs: Date.now() - started }
}

/**
 * Serialises Odesli API calls with a fixed minimum interval (~8 req/s).
 */

import { resolveOdesliSmartLink } from './odesliApi'
import { withApiRetry } from './retryPolicy'

const MIN_INTERVAL_MS = 120

let lastCallAt = 0
let chain: Promise<void> = Promise.resolve()

function scheduleGap(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastCallAt))
  if (wait === 0) {
    lastCallAt = now
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      lastCallAt = Date.now()
      resolve()
    }, wait)
  })
}

/** Reset throttle state — for tests only. */
export function resetOdesliThrottleForTests(): void {
  lastCallAt = 0
  chain = Promise.resolve()
}

/**
 * Resolves a music URL through Odesli with throttling and API-specific retries.
 */
export async function resolveOdesliSmartLinkThrottled(
  musicUrl: string,
  fetchFn: typeof fetch,
): Promise<Awaited<ReturnType<typeof resolveOdesliSmartLink>>> {
  const run = chain.then(async () => {
    await scheduleGap()
    return withApiRetry('odesli', () => resolveOdesliSmartLink(musicUrl, fetchFn))
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
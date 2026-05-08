/**
 * src/lib/rateLimiter.ts
 *
 * Defensive rate-limiting utilities for server-side external API calls.
 *
 * Usage:
 *   const data = await withExponentialBackoff(() => fetchSomeApi())
 *
 * HTTP errors should be wrapped with HttpError so the retrier can distinguish
 * retryable (429, 5xx) from non-retryable (4xx) failures.
 */

/** Represents an HTTP error response from an external API. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Returns true if the error is worth retrying.
 * Retryable: 429 Too Many Requests or any 5xx server error.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status >= 500
  }
  return false
}

/**
 * Executes `fn` with exponential backoff retries.
 *
 * @param fn          - Async function to execute (and retry on failure)
 * @param maxRetries  - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay in ms; doubles on each retry (default: 500)
 * @returns           - Resolved value from `fn`
 * @throws            - Re-throws the last error after all retries are exhausted,
 *                      or immediately for non-retryable errors.
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === maxRetries) throw err
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastErr
}

/**
 * src/lib/clientErrors.ts
 *
 * Client-side error utilities for translating API error responses into the
 * user's active language using the i18n dictionary.
 *
 * Usage:
 *   const res = await fetch('/api/some-route', { ... })
 *   if (!res.ok) {
 *     const body = await res.json() as ApiErrorResponse
 *     const tErrors = useTranslations('errors')
 *     toast.error(getErrorMessage(body, tErrors))
 *     return
 *   }
 *
 * Rules:
 *  - NEVER surface raw HTTP status codes to the user (no "HTTP 413" strings).
 *  - NEVER surface internal details from the error body.
 *  - Always fall back to SERVER_ERROR if the code is unrecognised.
 */

import type { Dictionary } from '@/i18n/types'
import type { ApiErrorResponse } from './errors'
import { ERROR_CODES } from './errorCodes'

/**
 * Returns the translated error message for an API error response.
 *
 * 1. Checks if the response `code` matches a known ErrorCode.
 * 2. If so, returns the dictionary translation for that code.
 * 3. Otherwise falls back to `errors.SERVER_ERROR`.
 *
 * @param body    - Parsed JSON body from a non-ok API response.
 * @param tErrors - `useTranslations('errors')` (or compatible translator).
 */
export function getErrorMessage(
  body: ApiErrorResponse,
  tErrors: (code: keyof Dictionary['errors']) => string,
): string {
  const code = body.code
  if (code && (ERROR_CODES as readonly string[]).includes(code)) {
    return tErrors(code as keyof Dictionary['errors'])
  }
  return tErrors('SERVER_ERROR')
}

/**
 * Parses the JSON body of an API response and calls `getErrorMessage`.
 * Returns `errors.SERVER_ERROR` if JSON parsing fails.
 *
 * @param res     - A non-ok `Response` object from `fetch`.
 * @param tErrors - `useTranslations('errors')` (or compatible translator).
 */
export async function getResponseErrorMessage(
  res: Response,
  tErrors: (code: keyof Dictionary['errors']) => string,
): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorResponse
    return getErrorMessage(body, tErrors)
  } catch {
    return tErrors('SERVER_ERROR')
  }
}

/** Like `getErrorMessage` but accepts only the `errors` slice of the dictionary. */
export function getErrorMessageFromErrors(
  body: ApiErrorResponse,
  errors: Dictionary['errors'],
): string {
  const code = body.code
  if (code && (ERROR_CODES as readonly string[]).includes(code)) {
    return errors[code as keyof Dictionary['errors']]
  }
  return errors.SERVER_ERROR
}

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
 *     toast.error(getErrorMessage(body, dict))
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
 * 3. Otherwise falls back to `dict.errors.SERVER_ERROR`.
 *
 * @param body   - Parsed JSON body from a non-ok API response.
 * @param dict   - The active locale's full dictionary.
 */
export function getErrorMessage(body: ApiErrorResponse, dict: Dictionary): string {
  const code = body.code
  if (code && (ERROR_CODES as readonly string[]).includes(code)) {
    return dict.errors[code as keyof Dictionary['errors']]
  }
  return dict.errors.SERVER_ERROR
}

/**
 * Parses the JSON body of an API response and calls `getErrorMessage`.
 * Returns `dict.errors.SERVER_ERROR` if JSON parsing fails.
 *
 * @param res    - A non-ok `Response` object from `fetch`.
 * @param dict   - The active locale's full dictionary.
 */
export async function getResponseErrorMessage(res: Response, dict: Dictionary): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorResponse
    return getErrorMessage(body, dict)
  } catch {
    return dict.errors.SERVER_ERROR
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

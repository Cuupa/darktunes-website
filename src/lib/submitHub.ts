/**
 * src/lib/submitHub.ts — SubmitHub link resolution
 */

/** Fallback SubmitHub playlister link used when no URL is configured in Site Settings. */
export const DEFAULT_SUBMIT_HUB_URL = 'https://sbmt.to/darktunes-music-group'

/**
 * Resolves the configured SubmitHub URL into a safe, absolute link.
 * Falls back to {@link DEFAULT_SUBMIT_HUB_URL} when unset, and prepends
 * `https://` to bare domains (e.g. admins pasting `sbmt.to/...` without a scheme).
 */
export function resolveSubmitHubUrl(url?: string | null): string {
  const trimmed = url?.trim()
  if (!trimmed) return DEFAULT_SUBMIT_HUB_URL
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/**
 * Invite link validity bounds (admin System setting).
 * Min 24h, max 7 days, default 7 days.
 */

export const INVITE_LINK_EXPIRY_HOURS_MIN = 24
export const INVITE_LINK_EXPIRY_HOURS_MAX = 168 // 7 days
export const INVITE_LINK_EXPIRY_HOURS_DEFAULT = 168

/** Preset options shown in the System UI. */
export const INVITE_LINK_EXPIRY_PRESETS = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
  { hours: 72, label: '3 days' },
  { hours: 120, label: '5 days' },
  { hours: 168, label: '7 days' },
] as const

/**
 * Clamp / parse invite link expiry hours to the allowed range.
 * Non-finite or missing values fall back to the default (7 days).
 */
export function normalizeInviteLinkExpiryHours(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN
  if (!Number.isFinite(n)) return INVITE_LINK_EXPIRY_HOURS_DEFAULT
  return Math.min(
    INVITE_LINK_EXPIRY_HOURS_MAX,
    Math.max(INVITE_LINK_EXPIRY_HOURS_MIN, Math.round(n)),
  )
}

/** Absolute expiry timestamp for a new invite created at `from` (default: now). */
export function computeInviteExpiresAt(
  expiryHours: number,
  from: Date = new Date(),
): Date {
  const hours = normalizeInviteLinkExpiryHours(expiryHours)
  return new Date(from.getTime() + hours * 60 * 60 * 1000)
}

/**
 * Human-readable absolute expiry for emails (UTC + local-friendly ISO).
 * Example: "28 July 2026, 14:30 UTC"
 */
export function formatInviteExpiresAt(expiresAt: Date): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(expiresAt)
  return `${formatted} UTC`
}

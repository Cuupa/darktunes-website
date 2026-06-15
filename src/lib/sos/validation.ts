/** UUID regex - validates v4 UUIDs (also accepts v1-v5 and nil UUID). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Period string must be `YYYY-MM` or `Q{N}-YYYY`. */
const PERIOD_RE = /^(\d{4}-\d{2}|Q[1-4]-\d{4})$/

/** Returns true when the string looks like a valid UUID (v1-v5 or nil). */
export function isValidArtistId(value: string): boolean {
  return UUID_RE.test(value)
}

/** Returns true when the period string is in a supported format. */
export function isValidPeriod(value: string): boolean {
  return PERIOD_RE.test(value)
}

/**
 * Pure surface-validation helpers for Admin Accounting forms.
 * Keep UI free of ad-hoc parseFloat / clamp logic.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const ISO_DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AccountingInputError }

export type AccountingInputError =
  | 'required'
  | 'invalid'
  | 'out_of_range'
  | 'too_many_decimals'
  | 'period_order'
  | 'invalid_email'
  | 'invalid_iban'

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Accepts "12,5" or "12.5". Strips a trailing decimal separator ("12." → "12"). */
export function normalizeDecimalInput(raw: string): string {
  let cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1)
  if (cleaned === '-' || cleaned === '') return cleaned
  return cleaned
}

export function parseRequiredPercent(raw: string): ParseResult<number> {
  const cleaned = normalizeDecimalInput(raw)
  if (!cleaned) return { ok: false, error: 'required' }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid' }
  if (n < 0 || n > 100) return { ok: false, error: 'out_of_range' }
  return { ok: true, value: clampPercent(n) }
}

export function parseOptionalPercent(raw: string): ParseResult<number | undefined> {
  const cleaned = normalizeDecimalInput(raw)
  if (!cleaned) return { ok: true, value: undefined }
  return parseRequiredPercent(cleaned)
}

/**
 * Money amount in EUR. Default: >= 0.01, max 2 decimal places, max 1e9.
 */
export function parseMoneyAmount(
  raw: string,
  options: {
    required?: boolean
    allowZero?: boolean
    min?: number
    max?: number
  } = {},
): ParseResult<number> {
  const { required = true, allowZero = false, min, max = 1_000_000_000 } = options
  const cleaned = normalizeDecimalInput(raw)
  if (!cleaned) {
    return required ? { ok: false, error: 'required' } : { ok: true, value: 0 }
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned) && !/^-?\d+\.\d{3,}$/.test(cleaned)) {
    // still allow pure integers / 1-2 decimals; reject garbage
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: 'invalid' }
  }
  if (/\.\d{3,}$/.test(cleaned)) return { ok: false, error: 'too_many_decimals' }

  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid' }

  const lower = min ?? (allowZero ? 0 : 0.01)
  if (n < lower || n > max) return { ok: false, error: 'out_of_range' }

  // Normalise to cents precision
  return { ok: true, value: Math.round(n * 100) / 100 }
}

export function parsePositiveInt(
  raw: string,
  options: { min?: number; max?: number; required?: boolean } = {},
): ParseResult<number> {
  const { min = 1, max = 365, required = true } = options
  const cleaned = raw.trim()
  if (!cleaned) {
    return required ? { ok: false, error: 'required' } : { ok: true, value: min }
  }
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'invalid' }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return { ok: false, error: 'invalid' }
  if (n < min || n > max) return { ok: false, error: 'out_of_range' }
  return { ok: true, value: n }
}

export function isValidEmail(raw: string): boolean {
  const v = raw.trim()
  if (!v) return false
  if (v.length > 254) return false
  return EMAIL_RE.test(v)
}

export function parseOptionalEmail(raw: string): ParseResult<string | undefined> {
  const v = raw.trim()
  if (!v) return { ok: true, value: undefined }
  if (!isValidEmail(v)) return { ok: false, error: 'invalid_email' }
  return { ok: true, value: v }
}

export function parseRequiredEmail(raw: string): ParseResult<string> {
  const v = raw.trim()
  if (!v) return { ok: false, error: 'required' }
  if (!isValidEmail(v)) return { ok: false, error: 'invalid_email' }
  return { ok: true, value: v }
}

export function isValidYearMonth(raw: string): boolean {
  return YEAR_MONTH_RE.test(raw.trim())
}

export function parseYearMonth(raw: string): { year: number; month: number } | null {
  const match = YEAR_MONTH_RE.exec(raw.trim())
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

/** Negative if a < b, 0 if equal, positive if a > b. Null if either invalid. */
export function compareYearMonth(a: string, b: string): number | null {
  const pa = parseYearMonth(a)
  const pb = parseYearMonth(b)
  if (!pa || !pb) return null
  return pa.year * 12 + pa.month - (pb.year * 12 + pb.month)
}

export function isValidPeriodRange(start: string, end: string): boolean {
  if (!isValidYearMonth(start) || !isValidYearMonth(end)) return false
  const cmp = compareYearMonth(start, end)
  return cmp != null && cmp <= 0
}

export function isValidIsoDate(raw: string): boolean {
  const match = ISO_DATE_RE.exec(raw.trim())
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const d = new Date(Date.UTC(year, month - 1, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  )
}

export function compareIsoDate(a: string, b: string): number | null {
  if (!isValidIsoDate(a) || !isValidIsoDate(b)) return null
  return a.localeCompare(b)
}

export function isValidIsoDateRange(start: string, end: string): boolean {
  const cmp = compareIsoDate(start, end)
  return cmp != null && cmp <= 0
}

/** Format IBAN with groups of 4 for display while typing. */
export function formatIbanDisplay(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return cleaned.replace(/(.{4})/g, '$1 ').trim()
}

export function isNonEmptyText(raw: string, maxLen = 500): boolean {
  const v = raw.trim()
  return v.length > 0 && v.length <= maxLen
}

export function sanitizeText(raw: string, maxLen = 500): string {
  return raw.slice(0, maxLen)
}

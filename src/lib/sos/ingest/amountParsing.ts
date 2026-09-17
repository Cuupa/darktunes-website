/**
 * Source-aware number parsing for SOS ingest.
 *
 * The convention comes from the source/profile, never from the UI locale.
 * Invalid or ambiguous values are reported instead of being coerced to 0 —
 * a decimal comma must never be misread as a thousands separator (the old
 * `parseCurrencyAmount` turned `15,79` into `1579`).
 */

export type AmountConvention = 'de' | 'en' | 'auto'

export type NumberParseError = 'ambiguous' | 'malformed' | 'not-finite'

export type ParsedNumber =
  | { kind: 'valid'; value: number }
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: NumberParseError; raw: string }

/**
 * Per-source decimal/thousands convention. Believe, Bandcamp, Shopify and
 * Printful exports use the US/UK format (dot decimal, comma thousands);
 * Darkmerch uses the German format (comma decimal, dot thousands).
 */
export const SOURCE_AMOUNT_CONVENTION = {
  believe: 'en',
  bandcamp: 'en',
  shopify: 'en',
  printful: 'en',
  darkmerch: 'de',
} as const satisfies Record<string, AmountConvention>

export type AmountSource = keyof typeof SOURCE_AMOUNT_CONVENTION

const CURRENCY_AND_SPACE = /[\s\u00A0\u202F€$£¥]/g

/** `1.234,56` / `1.234` / `15,79` / `1234` — dot thousands, comma decimal. */
const DE_PATTERN = /^(?:\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)$/
/** `1,234.56` / `1,234` / `15.79` / `1234` — comma thousands, dot decimal. */
const EN_PATTERN = /^(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)$/
/** A single separator followed by exactly three digits: `1,234` / `12.345`. */
const AMBIGUOUS_GROUP = /^\d{1,3}[.,]\d{3}$/
const PLAIN_DECIMAL = /^\d+[.,]\d+$/
const DIGITS_ONLY = /^\d+$/
const INTEGER = /^[+-]?\d+$/

function invalid(reason: NumberParseError, raw: string): ParsedNumber {
  return { kind: 'invalid', reason, raw }
}

function toFinite(normalised: string, raw: string, sign = 1): ParsedNumber {
  const value = Number(normalised)
  if (!Number.isFinite(value)) return invalid('not-finite', raw)
  return { kind: 'valid', value: sign * value }
}

function parseScientific(
  text: string,
  convention: AmountConvention,
  sign: number,
): ParsedNumber | null {
  if (!/[eE]/.test(text)) return null
  const mantissaPattern = convention === 'de' ? /^(\d+(?:,\d+)?)[eE]([+-]?\d+)$/ : /^(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/
  const match = mantissaPattern.exec(text)
  if (!match) return null
  const mantissa = match[1].replace(',', '.')
  return toFinite(`${mantissa}e${match[2]}`, text, sign)
}

function normaliseDe(text: string): string {
  return text.replace(/\./g, '').replace(',', '.')
}

function normaliseEn(text: string): string {
  return text.replace(/,/g, '')
}

/**
 * Parses a currency/decimal amount with an explicit convention.
 *
 * - `de`: `15,79` → 15.79, `1.234,56` → 1234.56, `1,234.56` → invalid
 * - `en`: `15.79` → 15.79, `1,234.56` → 1234.56, `15,79` → invalid
 * - `auto`: only unambiguous values; a lone three-digit group (`1,234`) is a
 *   clarification error, never a guess.
 *
 * Currency symbols and whitespace are stripped. `abc`, `12x`, `NaN`,
 * `Infinity` and malformed grouping are `invalid` — never 0.
 */
export function parseAmount(
  raw: string | null | undefined,
  convention: AmountConvention = 'auto',
): ParsedNumber {
  if (raw == null) return { kind: 'empty' }
  let text = String(raw).trim()
  if (!text) return { kind: 'empty' }
  text = text.replace(CURRENCY_AND_SPACE, '')
  if (!text) return { kind: 'empty' }

  let sign = 1
  if (text.startsWith('-')) {
    sign = -1
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }
  if (!text || text.startsWith('-') || text.startsWith('+')) return invalid('malformed', raw)

  const scientific = parseScientific(text, convention, sign)
  if (scientific) return scientific

  if (!/^[\d.,]+$/.test(text)) return invalid('malformed', raw)

  if (convention === 'de') {
    if (!DE_PATTERN.test(text)) return invalid('malformed', raw)
    return toFinite(normaliseDe(text), raw, sign)
  }

  if (convention === 'en') {
    if (!EN_PATTERN.test(text)) return invalid('malformed', raw)
    return toFinite(normaliseEn(text), raw, sign)
  }

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const hasComma = lastComma !== -1
  const hasDot = lastDot !== -1

  if (hasComma && hasDot) {
    // Both separators present: the last one is the decimal separator.
    if (lastComma > lastDot) {
      if (!DE_PATTERN.test(text)) return invalid('malformed', raw)
      return toFinite(normaliseDe(text), raw, sign)
    }
    if (!EN_PATTERN.test(text)) return invalid('malformed', raw)
    return toFinite(normaliseEn(text), raw, sign)
  }

  if (hasComma || hasDot) {
    if (AMBIGUOUS_GROUP.test(text)) return invalid('ambiguous', raw)
    if (!PLAIN_DECIMAL.test(text)) return invalid('malformed', raw)
    return toFinite(text.replace(',', '.'), raw, sign)
  }

  if (!DIGITS_ONLY.test(text)) return invalid('malformed', raw)
  return toFinite(text, raw, sign)
}

/**
 * Parses a quantity. Quantities are integers per source schema; refunds may
 * be negative. `0` is a valid value and must never be replaced by 1.
 */
export function parseIntegerAmount(raw: string | null | undefined): ParsedNumber {
  if (raw == null) return { kind: 'empty' }
  const text = String(raw).replace(CURRENCY_AND_SPACE, '').trim()
  if (!text) return { kind: 'empty' }
  if (!INTEGER.test(text)) return invalid('malformed', raw)
  return toFinite(text, raw)
}

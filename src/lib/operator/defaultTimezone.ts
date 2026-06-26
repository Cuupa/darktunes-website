import { DEFAULT_LABEL_INFO } from '@/lib/sos/defaults'
import type { SiteSettings } from '@/types'

/** Hard fallback for this German-law-focused CMS product. */
export const DEFAULT_OPERATOR_TIMEZONE = 'Europe/Berlin'

const COUNTRY_TO_IANA: Record<string, string> = {
  DE: 'Europe/Berlin',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  GB: 'Europe/London',
  UK: 'Europe/London',
  US: 'America/New_York',
  UTC: 'UTC',
}

const COUNTRY_NAME_PATTERNS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(deutschland|germany)\b/i, code: 'DE' },
  { pattern: /\b(österreich|austria)\b/i, code: 'AT' },
  { pattern: /\b(schweiz|switzerland)\b/i, code: 'CH' },
  { pattern: /\b(united kingdom|great britain|england)\b/i, code: 'GB' },
  { pattern: /\b(united states|usa)\b/i, code: 'US' },
]

/** Curated IANA zones for the scheduling picker (operator default is listed first). */
export const SCHEDULE_TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Europe/Berlin', label: 'Europe/Berlin (DE)' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna (AT)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CH)' },
  { value: 'Europe/London', label: 'Europe/London (UK)' },
  { value: 'America/New_York', label: 'America/New_York (US East)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (US West)' },
  { value: 'UTC', label: 'UTC' },
]

function countryCodeFromAddress(address: string, vatId?: string): string | null {
  const trimmed = address.trim()
  if (!trimmed && !vatId) return null

  if (vatId) {
    const vatCountry = vatId.trim().slice(0, 2).toUpperCase()
    if (/^[A-Z]{2}$/.test(vatCountry) && COUNTRY_TO_IANA[vatCountry]) {
      return vatCountry
    }
  }

  for (const { pattern, code } of COUNTRY_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return code
  }

  if (/^\s*\d{5}\s+\S+/m.test(trimmed)) return 'DE'

  return null
}

function timezoneFromAddress(address: string, vatId?: string): string | null {
  const code = countryCodeFromAddress(address, vatId)
  if (!code) return null
  return COUNTRY_TO_IANA[code] ?? null
}

/**
 * Resolves the operator headquarters timezone from site settings (Impressum).
 * Fallback chain: impressum address → SOS default label address → Europe/Berlin.
 */
export function resolveOperatorTimezone(
  settings?: Pick<SiteSettings, 'impressumAddress' | 'impressumVatId'> | null,
): string {
  const impressumTz = timezoneFromAddress(
    settings?.impressumAddress ?? '',
    settings?.impressumVatId,
  )
  if (impressumTz) return impressumTz

  const fallbackTz = timezoneFromAddress(DEFAULT_LABEL_INFO.address, DEFAULT_LABEL_INFO.taxId)
  return fallbackTz ?? DEFAULT_OPERATOR_TIMEZONE
}

/** Timezone options for the scheduling picker, with operator default first. */
export function getScheduleTimezoneOptions(
  operatorTimezone: string,
): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const options: Array<{ value: string; label: string }> = []

  const push = (value: string, label: string) => {
    if (seen.has(value)) return
    seen.add(value)
    options.push({ value, label })
  }

  const known = SCHEDULE_TIMEZONE_OPTIONS.find((o) => o.value === operatorTimezone)
  push(operatorTimezone, known?.label ?? `${operatorTimezone} (operator)`)

  for (const option of SCHEDULE_TIMEZONE_OPTIONS) {
    push(option.value, option.label)
  }

  return options
}
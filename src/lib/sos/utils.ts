import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { LabelInfo, AppDefaults, EmailConfig } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Replaces any non-alphanumeric characters with underscores for safe filenames. */
export function createSafeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_')
}

/**
 * Formats a YYYY-MM string as a short month + 2-digit year label (e.g. "Jan 24").
 * Returns the original value unchanged if the input is not a valid YYYY-MM string.
 */
export function formatMonthTick(v: string): string {
  if (!v || !/^\d{4}-\d{2}$/.test(v)) return v
  const [y, m] = v.split('-')
  const year = Number(y)
  const month = Number(m) - 1
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return v
  const d = new Date(year, month)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/** Resolve template placeholders in an e-mail template string. */
export function resolveTemplate(
  template: string,
  artist: string,
  period: string,
  amount: string,
  labelInfo: LabelInfo,
  appDefaults: Partial<AppDefaults>
): string {
  return template
    .replace(/\{artist\}/g, artist)
    .replace(/\{period\}/g, period)
    .replace(/\{amount\}/g, amount)
    .replace(/\{label_name\}/g, labelInfo.name || '')
    .replace(/\{label_vat_id\}/g, labelInfo.taxId || '')
    .replace(/\{invoice_email\}/g, appDefaults.financeEmail ?? '')
    .replace(/\{deadline_date\}/g, appDefaults.invoiceDeadlineDate ?? '')
    .replace(/\{donation_org\}/g, appDefaults.royaltyDonationOrg ?? '')
}

/**
 * Builds a mailto: URL for sending an artist statement e-mail.
 * Opens the default mail client with pre-filled fields.
 */
export function buildMailtoLink(
  artist: string,
  artistEmail: string,
  period: string,
  amount: string,
  labelInfo: LabelInfo,
  emailConfig: Partial<EmailConfig>,
  appDefaults: Partial<AppDefaults>,
  template: string
): string {
  const subject = resolveTemplate(
    emailConfig.subjectTemplate ?? 'Statement of Sales – {period}',
    artist,
    period,
    amount,
    labelInfo,
    appDefaults
  )
  const body = resolveTemplate(template, artist, period, amount, labelInfo, appDefaults)

  // Build query string with proper encoding (URLSearchParams uses '+' for spaces
  // which mailto: clients do not understand — use encodeURIComponent instead).
  const parts: string[] = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
  ]
  if (emailConfig.replyTo) {
    parts.push(`reply-to=${encodeURIComponent(emailConfig.replyTo)}`)
  }

  return `mailto:${encodeURIComponent(artistEmail)}?${parts.join('&')}`
}

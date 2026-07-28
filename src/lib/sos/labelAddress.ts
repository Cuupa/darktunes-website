/**
 * Structured label address for Accounting UI.
 * Serialized to LabelInfo.address as multi-line text for PDF/export.
 */

export interface LabelAddressParts {
  street: string
  houseNumber: string
  postalCode: string
  city: string
  country: string
}

export const EMPTY_LABEL_ADDRESS: LabelAddressParts = {
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: '',
}

/** Split trailing house number from a street line, e.g. "Friedhofweg 1" → street + "1". */
export function splitStreetAndNumber(line: string): { street: string; houseNumber: string } {
  const trimmed = line.trim()
  if (!trimmed) return { street: '', houseNumber: '' }
  // Match house numbers like 12, 12a, 12-14, 12/1 at end of line
  const match = /^(.+?)\s+(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)$/.exec(trimmed)
  if (!match) return { street: trimmed, houseNumber: '' }
  return { street: (match[1] ?? '').trim(), houseNumber: (match[2] ?? '').trim() }
}

/**
 * Parse LabelInfo.address (multi-line or comma-separated) into structured fields.
 */
export function parseLabelAddress(address: string): LabelAddressParts {
  const raw = address.trim()
  if (!raw) return { ...EMPTY_LABEL_ADDRESS }

  // Prefer newlines; fall back to comma-separated single line
  let lines = raw
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (lines.length === 1 && lines[0]!.includes(',')) {
    lines = lines[0]!.split(',').map((s) => s.trim()).filter(Boolean)
  }

  if (lines.length === 0) return { ...EMPTY_LABEL_ADDRESS }

  if (lines.length === 1) {
    const { street, houseNumber } = splitStreetAndNumber(lines[0]!)
    return { street, houseNumber, postalCode: '', city: '', country: '' }
  }

  const first = lines[0] ?? ''
  const { street, houseNumber } = splitStreetAndNumber(first)

  // Line 2 often "PLZ City"
  let postalCode = ''
  let city = ''
  let country = ''

  if (lines.length >= 2) {
    const line2 = lines[1] ?? ''
    const postalMatch = /^(\d{4,5})\s+(.+)$/.exec(line2)
    if (postalMatch) {
      postalCode = postalMatch[1] ?? ''
      city = postalMatch[2] ?? ''
    } else {
      // Maybe "City" only, or "PLZ" only
      const onlyPostal = /^\d{4,5}$/.exec(line2)
      if (onlyPostal) postalCode = onlyPostal[0]
      else city = line2
    }
  }

  if (lines.length >= 3) {
    country = lines[2] ?? ''
  }

  // If line2 had no PLZ and line3 looks like "PLZ City" was mis-split
  if (!postalCode && city) {
    const postalInCity = /^(\d{4,5})\s+(.+)$/.exec(city)
    if (postalInCity) {
      postalCode = postalInCity[1] ?? ''
      city = postalInCity[2] ?? ''
    }
  }

  return { street, houseNumber, postalCode, city, country }
}

/**
 * Compose structured address into multi-line LabelInfo.address for PDF.
 * Format:
 *   Street 12
 *   69118 Heidelberg
 *   Germany
 */
export function composeLabelAddress(parts: LabelAddressParts): string {
  const streetLine = [parts.street.trim(), parts.houseNumber.trim()].filter(Boolean).join(' ')
  const cityLine = [parts.postalCode.trim(), parts.city.trim()].filter(Boolean).join(' ')
  return [streetLine, cityLine, parts.country.trim()].filter(Boolean).join('\n')
}

export function isLabelAddressComplete(parts: LabelAddressParts): boolean {
  return Boolean(
    parts.street.trim() &&
      parts.postalCode.trim() &&
      parts.city.trim() &&
      parts.country.trim(),
  )
}

import type { BrandI18nValues } from '@/lib/brand/i18nValues'

const PLACEHOLDER_RE = /\{(labelName|labelShortName|siteUrl|siteHost)\}/g

function resolveString(value: string, brand: BrandI18nValues): string {
  return value.replace(PLACEHOLDER_RE, (match, key: keyof BrandI18nValues) => {
    const resolved = brand[key]
    return resolved.length > 0 ? resolved : match
  })
}

/** Deep-resolve {labelName} ICU placeholders in loaded message trees at request time. */
export function resolveBrandPlaceholders<T>(messages: T, brand: BrandI18nValues): T {
  if (typeof messages === 'string') {
    return resolveString(messages, brand) as T
  }

  if (Array.isArray(messages)) {
    return messages.map((entry) => resolveBrandPlaceholders(entry, brand)) as T
  }

  if (messages && typeof messages === 'object') {
    return Object.fromEntries(
      Object.entries(messages).map(([key, value]) => [
        key,
        resolveBrandPlaceholders(value, brand),
      ]),
    ) as T
  }

  return messages
}
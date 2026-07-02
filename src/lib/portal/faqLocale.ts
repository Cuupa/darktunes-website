/**
 * Resolves localized portal FAQ fields with EN fallback.
 */

export function resolveFaqLocaleField(
  locale: string,
  en: string,
  de: string | null | undefined,
): string {
  if (locale === 'de') {
    const trimmed = de?.trim()
    if (trimmed) return trimmed
  }
  return en
}
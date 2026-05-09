/**
 * src/i18n/getDictionary.ts — Server-side dictionary loader
 *
 * Reads the active locale from:
 *  1. The `NEXT_LOCALE` cookie (user preference, set by middleware or locale switcher)
 *  2. The `Accept-Language` request header (browser default)
 *  3. Falls back to German (`de`) as the site's primary language.
 *
 * IMPORTANT: This module uses `cookies()` and `headers()` from `next/headers`,
 * which are only available in Server Components and Route Handlers.
 * Never call this from a Client Component.
 */

import { cookies, headers } from 'next/headers'
import type { Dictionary, Locale } from './types'

const SUPPORTED_LOCALES: Locale[] = ['en', 'de']
const DEFAULT_LOCALE: Locale = 'de'

/** Dynamically load a locale's dictionary JSON. */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./dictionaries/en.json').then((m) => m.default as Dictionary),
  de: () => import('./dictionaries/de.json').then((m) => m.default as Dictionary),
}

/**
 * Parses the primary language tag from an `Accept-Language` header value.
 * e.g. "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7" → "de"
 */
function parseAcceptLanguage(header: string): Locale | null {
  const primary = header.split(',')[0]?.split(';')[0]?.trim().split('-')[0]?.toLowerCase()
  if (primary === 'de') return 'de'
  if (primary === 'en') return 'en'
  return null
}

/** Resolve the active locale for the current server request. */
export async function getLocale(): Promise<Locale> {
  try {
    // 1. Cookie preference (highest priority)
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
    if (cookieLocale && (SUPPORTED_LOCALES as string[]).includes(cookieLocale)) {
      return cookieLocale as Locale
    }

    // 2. Accept-Language header
    const headerStore = await headers()
    const acceptLanguage = headerStore.get('accept-language') ?? ''
    const fromHeader = parseAcceptLanguage(acceptLanguage)
    if (fromHeader) return fromHeader
  } catch {
    // Outside a request context (e.g., during static build)
  }

  return DEFAULT_LOCALE
}

/**
 * Load the dictionary for the current locale.
 * Falls back to English if the locale dictionary fails to load.
 */
export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  const resolved = locale ?? (await getLocale())
  const load = loaders[resolved] ?? loaders[DEFAULT_LOCALE]
  try {
    return await load()
  } catch {
    // Graceful fallback to English
    return loaders.en()
  }
}

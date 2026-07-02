import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'
import { resolveBrandFromSettings } from '@/lib/brand'
import { brandI18nValues } from '@/lib/brand/i18nValues'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { resolveBrandPlaceholders } from '@/i18n/resolveBrandPlaceholders'
import type { Locale } from './types'
import { routing } from './routing'

function parseAcceptLanguage(header: string): Locale | null {
  const primary = header.split(',')[0]?.split(';')[0]?.trim().split('-')[0]?.toLowerCase()
  if (primary === 'de') return 'de'
  if (primary === 'en') return 'en'
  return null
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
  let locale: Locale = routing.defaultLocale

  const pathname = headerStore.get('x-pathname') ?? ''

  if (cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale as Locale
  } else {
    const fromHeader = parseAcceptLanguage(headerStore.get('accept-language') ?? '')
    if (fromHeader) {
      locale = fromHeader
    } else {
      locale = pathname.startsWith('/portal') ? 'en' : routing.defaultLocale
    }
  }

  const { loadMessages, resolveBundle } = await import('./loadMessages')
  const bundle = resolveBundle(pathname)
  const rawMessages = await loadMessages(locale, bundle)
  const settings =
    (await getCachedSiteSettings().catch(() => null)) ?? SITE_SETTINGS_DEFAULTS
  const brand = brandI18nValues(resolveBrandFromSettings(settings))

  return {
    locale,
    messages: resolveBrandPlaceholders(rawMessages, brand),
  }
})
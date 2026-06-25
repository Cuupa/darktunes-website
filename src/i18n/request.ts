import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
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

  if (cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale as Locale
  } else {
    const fromHeader = parseAcceptLanguage(headerStore.get('accept-language') ?? '')
    if (fromHeader) {
      locale = fromHeader
    } else {
      const pathname = headerStore.get('x-pathname') ?? ''
      locale = pathname.startsWith('/portal') ? 'en' : routing.defaultLocale
    }
  }

  const { loadMessages } = await import('./loadMessages')
  return {
    locale,
    messages: await loadMessages(locale),
  }
})
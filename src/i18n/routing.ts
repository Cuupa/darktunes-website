import { defineRouting } from 'next-intl/routing'
import { SECONDS_PER_YEAR } from '@/lib/datetime/constants'

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'de',
  localePrefix: 'never',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: SECONDS_PER_YEAR,
  },
})
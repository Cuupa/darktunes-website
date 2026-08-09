import type { ReactNode } from 'react'
import enMessages from '@/i18n/messages/en/index'
import type { Dictionary } from '@/i18n/types'

export const testMessages = enMessages as unknown as Dictionary

function resolveMessage(namespace: string, key: string): string {
  // Support dotted namespaces (e.g. useTranslations('admin.nav')).
  const nsParts = namespace.split('.')
  let slice: unknown = testMessages
  for (const part of nsParts) {
    if (slice && typeof slice === 'object' && part in (slice as object)) {
      slice = (slice as Record<string, unknown>)[part]
    } else {
      slice = undefined
      break
    }
  }

  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, slice)

  return typeof value === 'string' ? value : key
}

export function createMockUseTranslations() {
  return (namespace: string) => (key: string, values?: Record<string, string | number | Date>) => {
    let msg = resolveMessage(namespace, key)
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        msg = msg.replaceAll(`{${name}}`, String(value))
        msg = msg.replaceAll(`{{${name}}}`, String(value))
      }
    }
    return msg
  }
}

export const mockNextIntl = {
  useTranslations: createMockUseTranslations(),
  useLocale: () => 'en',
  useMessages: () => testMessages,
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}
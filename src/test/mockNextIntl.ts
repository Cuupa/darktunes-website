import type { ReactNode } from 'react'
import enMessages from '@/i18n/messages/en/index'
import type { Dictionary } from '@/i18n/types'

export const testMessages = enMessages as unknown as Dictionary

function resolveMessage(namespace: string, key: string): string {
  const slice = (testMessages as Record<string, unknown>)[namespace]
  const value = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    if (slice && typeof slice === 'object' && part in slice) {
      return (slice as Record<string, unknown>)[part]
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
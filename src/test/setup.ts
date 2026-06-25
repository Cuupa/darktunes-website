import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'
import enDict from '@/i18n/dictionaries/en.json'
import { vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number | Date>) => {
    const slice = (enDict as Record<string, Record<string, unknown>>)[namespace]
    let msg = typeof slice?.[key] === 'string' ? (slice[key] as string) : key
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        msg = msg.replaceAll(`{${name}}`, String(value))
        msg = msg.replaceAll(`{{${name}}}`, String(value))
      }
    }
    return msg
  },
  useLocale: () => 'en',
  useMessages: () => enDict,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// jsdom exposes crypto.subtle in CI but it may not digest buffers; use Node Web Crypto.
const testCrypto = webcrypto as Crypto
Object.defineProperty(globalThis, 'crypto', {
  value: testCrypto,
  writable: true,
  configurable: true,
})
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: testCrypto,
    writable: true,
    configurable: true,
  })
}

// Test-only encryption master key (32 bytes hex). Never use in production.
if (!process.env.API_CREDENTIALS_ENCRYPTION_KEY) {
  process.env.API_CREDENTIALS_ENCRYPTION_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
}

// jsdom does not always provide a functional localStorage in Node 22+.
if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() { return store.size },
    },
    writable: true,
  })
}

import '@testing-library/jest-dom'

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

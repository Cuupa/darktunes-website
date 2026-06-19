import { afterEach, describe, expect, it, vi } from 'vitest'

describe('EPKPdfDocument font registration fallback', () => {
  afterEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('does not throw when Font.register fails and falls back to system font', async () => {
    vi.doMock('@react-pdf/renderer', () => ({
      Document: ({ children }: { children: unknown }) => children,
      Page: ({ children }: { children: unknown }) => children,
      View: ({ children }: { children: unknown }) => children,
      Text: ({ children }: { children: unknown }) => children,
      Image: () => null,
      Link: ({ children }: { children: unknown }) => children,
      StyleSheet: { create: (styles: object) => styles },
      Font: {
        register: vi.fn(() => {
          throw new Error('font registration failed')
        }),
        registerHyphenationCallback: vi.fn(),
      },
    }))

    const imported = await import('../../../app/portal/profile/_components/EPKPdfDocument')

    expect(imported).toBeDefined()
    expect(() =>
      imported.EPKPdfDocument({
        data: { artistName: 'Test Artist' },
      }),
    ).not.toThrow()
  })
})

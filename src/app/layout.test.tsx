import { beforeEach, describe, expect, it, vi } from 'vitest'

type SiteSettingsLike = {
  faviconUrl?: string
  seoTitle?: string
  seoDescription?: string
  ogTitle?: string
  ogDescription?: string
  noiseOpacity?: number
  crtScanlinesEnabled?: boolean
  vignetteIntensity?: number
} | null

let mockedSettings: SiteSettingsLike = null

vi.mock('next/font/google', () => ({
  Oxanium: () => ({ variable: '--font-sans' }),
  Roboto_Slab: () => ({ variable: '--font-serif' }),
  JetBrains_Mono: () => ({ variable: '--font-mono' }),
}))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

vi.mock('@/lib/api/siteSettings', () => ({
  getSiteSettings: vi.fn(async () => mockedSettings),
}))

describe('app/layout favicon metadata', () => {
  beforeEach(() => {
    mockedSettings = null
  })

  it('prefers custom favicon URL in metadata icons and shortcut', async () => {
    mockedSettings = { faviconUrl: 'https://cdn.example.com/custom-favicon.png' }
    const { generateMetadata } = await import('../../app/layout')

    const metadata = await generateMetadata()
    const icons = metadata.icons as { icon: Array<{ url: string }>; shortcut: string }

    expect(icons.icon[0]).toMatchObject({ url: 'https://cdn.example.com/custom-favicon.png' })
    expect(icons.icon[1]).toMatchObject({ url: '/favicon.svg' })
    expect(icons.shortcut).toBe('https://cdn.example.com/custom-favicon.png')
  })

  it('falls back to /icons/icon-192.png when custom favicon is absent', async () => {
    mockedSettings = { faviconUrl: '' }
    const { generateMetadata } = await import('../../app/layout')

    const metadata = await generateMetadata()
    const icons = metadata.icons as { icon: Array<{ url: string }>; shortcut: string }

    expect(icons.icon[0]).toMatchObject({ url: '/icons/icon-192.png' })
    expect(icons.icon[1]).toMatchObject({ url: '/favicon.svg' })
    expect(icons.shortcut).toBe('/icons/icon-192.png')
  })
})

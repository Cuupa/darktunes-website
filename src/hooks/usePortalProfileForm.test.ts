import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PORTAL_PHOTO_MAX_BYTES, profileSchema, usePortalProfileForm } from './usePortalProfileForm'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual<typeof import('react-hook-form')>('react-hook-form')
  return {
    ...actual,
    useWatch: () => ({}),
  }
})

describe('usePortalProfileForm', () => {
  it('exposes default state from artist fallback', () => {
    const { result } = renderHook(() =>
      usePortalProfileForm({
        artistId: 'artist-1',
        initialProfile: null,
        artist: { imageUrl: 'https://example.com/photo.jpg', genres: [] } as never,
      }),
    )

    expect(result.current.photoUrl).toBe('https://example.com/photo.jpg')
    expect(typeof result.current.handleRiderDelete).toBe('function')
  })

  it('validates malformed profile urls', () => {
    const parsed = profileSchema.safeParse({ website_url: 'not-a-url' })
    expect(parsed.success).toBe(false)
    expect(PORTAL_PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})

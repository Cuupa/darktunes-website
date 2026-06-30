import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
    },
  }),
}))

import { useFanPageAutosave } from './useFanPageAutosave'

const document: LandingPageDocumentV1 = {
  version: 1,
  templateId: 'dark-minimal',
  theme: { paletteId: 'dark-minimal' },
  sections: [],
}

describe('useFanPageAutosave', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ documentVersion: 2 }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('starts idle when the document is clean', () => {
    const { result } = renderHook(() =>
      useFanPageAutosave({
        artistId: 'artist-1',
        document,
        isDirty: false,
        onSaved: vi.fn(),
        onMarkClean: vi.fn(),
        saveErrorMessage: 'Save failed',
      }),
    )

    expect(result.current.saveStatus).toBe('idle')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('derives pending status from isDirty without scheduling while saving', async () => {
    const onMarkClean = vi.fn()
    const { result, rerender } = renderHook(
      ({ isDirty }) =>
        useFanPageAutosave({
          artistId: 'artist-1',
          document,
          isDirty,
          onSaved: vi.fn(),
          onMarkClean,
          saveErrorMessage: 'Save failed',
          debounceMs: 20,
        }),
      { initialProps: { isDirty: false } },
    )

    rerender({ isDirty: true })
    expect(result.current.saveStatus).toBe('pending')

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
      expect(onMarkClean).toHaveBeenCalled()
    })
  })
})
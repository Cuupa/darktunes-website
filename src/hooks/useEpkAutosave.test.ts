import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEpkAutosave } from './useEpkAutosave'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
  }),
}))

describe('useEpkAutosave', () => {
  it('saves document immediately via saveNow', async () => {
    const onSaved = vi.fn()
    const onMarkClean = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documentVersion: 3 }) }))

    const { result } = renderHook(() =>
      useEpkAutosave({
        artistId: 'artist-1',
        document: { metadata: {}, pages: [], fonts: [] } as never,
        isDirty: false,
        onSaved,
        onMarkClean,
        saveErrorMessage: 'save failed',
      }),
    )

    await act(async () => {
      await result.current.saveNow()
    })

    expect(onMarkClean).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(3)
  })
})

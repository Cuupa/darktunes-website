import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSosRulesPresets } from './useSosRulesPresets'
import { DEFAULT_SOS_ACCOUNTING_SETTINGS } from '@/lib/sos/sosAccountingSettings'

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

describe('useSosRulesPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads presets and saves a preset', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ presets: [{ id: 'p1', name: 'Preset 1', config: {}, created_at: '', updated_at: '' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ preset: { id: 'p2', name: 'Preset 2', config: {}, created_at: '', updated_at: '' } }) }))

    const { result } = renderHook(() => useSosRulesPresets())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.presets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.savePreset('Preset 2', DEFAULT_SOS_ACCOUNTING_SETTINGS)
    })

    expect(result.current.presets[0]?.id).toBe('p2')
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('reports save errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ presets: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }))

    const { result } = renderHook(() => useSosRulesPresets())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.savePreset('Broken', DEFAULT_SOS_ACCOUNTING_SETTINGS)
    })

    expect(toastError).toHaveBeenCalledWith('Failed to save preset')
  })
})

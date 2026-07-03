import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCsvImportProfiles } from './useCsvImportProfiles'

describe('useCsvImportProfiles', () => {
  it('exposes merged profile list and updates custom profiles', () => {
    const setCustomProfiles = vi.fn()
    const { result } = renderHook(() => useCsvImportProfiles([], setCustomProfiles))

    expect(Array.isArray(result.current.profiles)).toBe(true)

    act(() => {
      result.current.saveProfile({
        id: 'custom-profile',
        name: 'Custom',
        type: 'financial',
        delimiter: ',',
        autoDetectHeaders: ['net'],
        columnMapping: { netRevenue: 'net' },
      })
    })

    expect(setCustomProfiles).toHaveBeenCalledTimes(1)
  })
})

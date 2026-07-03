import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  it('returns true on small viewport and reacts to media listener registration', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 640, writable: true, configurable: true })
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ addEventListener, removeEventListener })))

    const { result } = renderHook(() => useIsMobile())

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})

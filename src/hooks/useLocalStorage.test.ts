import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  it('returns initial value and persists updates', () => {
    const { result } = renderHook(() => useLocalStorage('use-local-storage-key', 1))
    expect(result.current[0]).toBe(1)

    act(() => {
      result.current[1]((prev) => prev + 2)
    })

    expect(result.current[0]).toBe(3)
    expect(window.localStorage.getItem('use-local-storage-key')).toBe('3')
  })
})

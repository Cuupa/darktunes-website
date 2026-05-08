import { useState, useCallback } from 'react'

/**
 * Persist a value in localStorage, providing the same `[value, setValue]`
 * API as Spark's `useKV` so it can be used as a drop-in replacement.
 *
 * @param key     - localStorage key
 * @param initial - default value when nothing is stored yet
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initial
    } catch {
      return initial
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // quota exceeded or private browsing – silently ignore
        }
        return next
      })
    },
    [key],
  )

  return [storedValue, setValue]
}

import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('flex')).toBe('flex')
  })

  it('merges multiple classes', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2')
  })

  it('resolves Tailwind class conflicts — last one wins', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })

  it('resolves bg-color conflicts', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('strips falsy conditional classes', () => {
    const active = false
    expect(cn('base', active && 'active')).toBe('base')
  })

  it('includes truthy conditional classes', () => {
    const active = true
    expect(cn('base', active && 'active')).toBe('base active')
  })

  it('handles undefined and null gracefully', () => {
    expect(cn('flex', undefined, null, 'block')).toBe('block')
  })

  it('handles object syntax from clsx', () => {
    expect(cn({ flex: true, hidden: false })).toBe('flex')
  })

  it('returns empty string when no valid inputs', () => {
    expect(cn(undefined, null, false as unknown as string)).toBe('')
  })
})

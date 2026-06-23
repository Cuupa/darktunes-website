import { describe, it, expect, vi } from 'vitest'
import { mapWithConcurrency } from './mapWithConcurrency'

describe('mapWithConcurrency', () => {
  it('returns empty array for empty input', async () => {
    const result = await mapWithConcurrency([], 3, async () => 'ok')
    expect(result).toEqual([])
  })

  it('preserves result order', async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 10)
    expect(result).toEqual([
      { status: 'fulfilled', value: 10 },
      { status: 'fulfilled', value: 20 },
      { status: 'fulfilled', value: 30 },
    ])
  })

  it('limits concurrent executions', async () => {
    let inFlight = 0
    let maxInFlight = 0

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 20))
      inFlight--
      return 'done'
    })

    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  it('captures rejected promises without stopping other workers', async () => {
    const fn = vi.fn(async (n: number) => {
      if (n === 2) throw new Error('boom')
      return n
    })

    const result = await mapWithConcurrency([1, 2, 3], 2, fn)

    expect(result[0]).toEqual({ status: 'fulfilled', value: 1 })
    expect(result[1]).toEqual({ status: 'rejected', reason: expect.any(Error) })
    expect(result[2]).toEqual({ status: 'fulfilled', value: 3 })
  })
})
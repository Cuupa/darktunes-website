import { describe, expect, it, vi } from 'vitest'
import {
  aggregateLastfmListenersMonthly,
  currentUtcMonthPeriod,
  fetchLastfmListenerHistory,
} from './lastfmApi'

describe('lastfmApi', () => {
  it('aggregates daily points to monthly peaks', () => {
    const monthly = aggregateLastfmListenersMonthly([
      { date: '2024-01-05', listeners: 100 },
      { date: '2024-01-20', listeners: 150 },
      { date: '2024-02-01', listeners: 120 },
    ])
    expect(monthly).toEqual([
      { period: '2024-01', listeners: 150 },
      { period: '2024-02', listeners: 120 },
    ])
  })

  it('parses Last.fm artist.getInfo listener snapshot', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          artist: {
            stats: {
              listeners: '12345',
            },
          },
        }),
    })

    const result = await fetchLastfmListenerHistory('test-key', 'Test Artist', mockFetch)
    expect(result).toEqual([
      { period: currentUtcMonthPeriod(), listeners: 12345 },
    ])
    expect(mockFetch).toHaveBeenCalledOnce()
    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string)
    expect(calledUrl.searchParams.get('method')).toBe('artist.getInfo')
  })

  it('throws on Last.fm API error payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 6, message: 'Invalid parameters' }),
    })

    await expect(fetchLastfmListenerHistory('k', 'Artist', mockFetch)).rejects.toThrow(
      'Invalid parameters',
    )
  })
})
import { describe, expect, it } from 'vitest'
import { parseNvidiaModelsList } from '@/lib/ai/provider/nvidiaModels'

describe('parseNvidiaModelsList', () => {
  it('returns ids from an OpenAI-style models payload', () => {
    expect(
      parseNvidiaModelsList({
        data: [
          { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Lightning' },
          { id: 'nvidia/nemotron-3-super-120b-a12b' },
        ],
      }),
    ).toEqual([
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Lightning' },
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: '' },
    ])
  })

  it('skips entries without an id and empty payloads', () => {
    expect(parseNvidiaModelsList(null)).toEqual([])
    expect(parseNvidiaModelsList({ data: [{ name: 'no-id' }, { id: '' }] })).toEqual([])
  })
})

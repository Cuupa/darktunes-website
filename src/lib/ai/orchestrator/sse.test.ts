import { describe, expect, it } from 'vitest'
import { encodeSse } from '@/lib/ai/orchestrator/sse'

describe('encodeSse', () => {
  it('should emit named events with JSON data', () => {
    expect(encodeSse({ type: 'delta', text: 'hi' })).toBe(
      'event: delta\ndata: {"type":"delta","text":"hi"}\n\n',
    )
  })
})

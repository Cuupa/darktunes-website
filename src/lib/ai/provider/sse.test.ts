import { describe, expect, it } from 'vitest'
import { mergeToolCallDeltas, parseSseBlock, parseUsage } from '@/lib/ai/provider/sse'
import { AiProviderError } from '@/lib/ai/provider/errors'

describe('SSE parser', () => {
  it('should parse a content delta frame', () => {
    const chunk = parseSseBlock(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    )
    expect(chunk?.contentDelta).toBe('Hello')
    expect(chunk?.done).toBe(false)
  })

  it('should parse CRLF SSE frames', () => {
    const chunk = parseSseBlock(
      'event: message\r\ndata: {"choices":[{"delta":{"content":"Hi"}}]}\r',
    )
    expect(chunk?.contentDelta).toBe('Hi')
  })

  it('should treat [DONE] as the end of the stream', () => {
    const chunk = parseSseBlock('data: [DONE]')
    expect(chunk?.done).toBe(true)
  })

  it('should throw INVALID_RESPONSE on non-JSON data', () => {
    expect(() => parseSseBlock('data: not-json')).toThrow(AiProviderError)
  })

  it('should merge incremental tool-call argument deltas', () => {
    const merged = mergeToolCallDeltas([], [
      { index: 0, id: 'call_1', name: 'echo_test', arguments: '{"pin' },
      { index: 0, arguments: 'g":"x"}' },
    ])
    expect(merged[0]).toEqual({
      id: 'call_1',
      name: 'echo_test',
      arguments: '{"ping":"x"}',
    })
  })

  it('should read reasoning tokens from completion_tokens_details', () => {
    const usage = parseUsage({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
      completion_tokens_details: { reasoning_tokens: 7 },
    })
    expect(usage).toEqual({
      input_tokens: 10,
      output_tokens: 20,
      reasoning_tokens: 7,
      total_tokens: 30,
    })
  })
})

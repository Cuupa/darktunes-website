import { describe, expect, it } from 'vitest'
import { MockAiProvider } from '@/lib/ai/provider/mock'
import { runNvidiaConnectionTest } from '@/lib/ai/provider/connectionTest'

describe('runNvidiaConnectionTest', () => {
  it('should pass when mock complete, stream, tools, and usage all succeed', async () => {
    const provider = new MockAiProvider({
      turns: [
        { content: 'pong', usage: { input_tokens: 4, output_tokens: 1, reasoning_tokens: 0, total_tokens: 5 } },
        { content: 'pong', usage: { input_tokens: 8, output_tokens: 2, reasoning_tokens: 3, total_tokens: 13 } },
        { content: 'pong', chunks: ['po', 'ng'], usage: { input_tokens: 4, output_tokens: 1, reasoning_tokens: 0, total_tokens: 5 } },
        {
          content: '',
          tool_calls: [{ id: 'call_1', name: 'echo_test', arguments: '{"ping":"pong"}' }],
          usage: { input_tokens: 12, output_tokens: 8, reasoning_tokens: 0, total_tokens: 20 },
        },
      ],
    })
    const result = await runNvidiaConnectionTest({ apiKey: 'mock', provider })
    expect(result.ok).toBe(true)
    expect(result.steps.every((step) => step.ok)).toBe(true)
    expect(result.usage.fast?.total_tokens).toBe(5)
  })

  it('should stop after the first failing step and never retry', async () => {
    const provider = new MockAiProvider({
      turns: [{ error: 'INVALID_KEY' }, { content: 'should not run' }],
    })
    const result = await runNvidiaConnectionTest({ apiKey: 'bad', provider })
    expect(result.ok).toBe(false)
    expect(result.steps[0]?.step).toBe('auth')
    const failed = result.steps.find((step) => !step.ok)
    expect(failed?.step).toBe('fast_complete')
    expect(failed?.error_code).toBe('INVALID_KEY')
    expect(result.steps.some((step) => step.step === 'reasoning_complete')).toBe(false)
  })

  it('should record TOOL_CALL_UNSUPPORTED without failing earlier steps', async () => {
    const provider = new MockAiProvider({
      turns: [
        { content: 'pong', usage: { input_tokens: 4, output_tokens: 1, reasoning_tokens: 0, total_tokens: 5 } },
        { content: 'pong', usage: { input_tokens: 8, output_tokens: 2, reasoning_tokens: 0, total_tokens: 10 } },
        { content: 'pong', chunks: ['pong'], usage: { input_tokens: 4, output_tokens: 1, reasoning_tokens: 0, total_tokens: 5 } },
        { content: 'I will not call tools.' },
      ],
    })
    const result = await runNvidiaConnectionTest({ apiKey: 'mock', provider })
    expect(result.ok).toBe(false)
    const tool = result.steps.find((step) => step.step === 'tool_call')
    expect(tool?.error_code).toBe('TOOL_CALL_UNSUPPORTED')
  })
})

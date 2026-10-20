import { describe, expect, it } from 'vitest'
import { estimateInputTokens, estimateTokens, preferProviderUsage } from '@/lib/ai/budget/estimator'

describe('token estimator', () => {
  it('should overestimate relative to a naive chars/4 count', () => {
    const text = 'a'.repeat(400)
    expect(estimateTokens(text)).toBeGreaterThan(Math.ceil(400 / 4))
  })

  it('should count system, history, user, and tool schema tokens separately', () => {
    const breakdown = estimateInputTokens(
      [
        { role: 'system', content: 'You are a helper.' },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'How many streams?' },
      ],
      [{ name: 'get_artist_analytics', description: 'analytics', parameters: { type: 'object' } }],
    )
    expect(breakdown.system).toBeGreaterThan(0)
    expect(breakdown.history).toBeGreaterThan(0)
    expect(breakdown.user).toBeGreaterThan(0)
    expect(breakdown.tools).toBeGreaterThan(0)
    expect(breakdown.total_input).toBe(
      breakdown.system + breakdown.history + breakdown.user + breakdown.tools,
    )
  })

  it('should prefer provider usage when the provider reported tokens', () => {
    const estimate = { input_tokens: 100, output_tokens: 20, reasoning_tokens: 0, total_tokens: 120 }
    const provider = { input_tokens: 80, output_tokens: 25, reasoning_tokens: 10, total_tokens: 115 }
    expect(preferProviderUsage(estimate, provider)).toEqual(provider)
    expect(preferProviderUsage(estimate, null)).toEqual(estimate)
  })
})

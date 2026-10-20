import { describe, expect, it } from 'vitest'
import { MockAiProvider } from '@/lib/ai/provider/mock'

describe('MockAiProvider', () => {
  it('should stream canned chunks then complete', async () => {
    const provider = new MockAiProvider({
      turns: [{ content: 'Hello world', chunks: ['Hello ', 'world'] }],
    })
    const texts: string[] = []
    for await (const event of provider.stream({
      request_id: 'm1',
      model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 20,
    })) {
      if (event.type === 'delta') texts.push(event.text)
    }
    expect(texts).toEqual(['Hello ', 'world'])
  })

  it('should surface a configured provider error', async () => {
    const provider = new MockAiProvider({ turns: [{ error: 'RATE_LIMITED' }] })
    await expect(
      provider.complete({
        request_id: 'm2',
        model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 20,
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

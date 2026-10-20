import { describe, expect, it } from 'vitest'
import { slideConversationWindow } from '@/lib/ai/context/window'

describe('slideConversationWindow', () => {
  it('should keep the system prompt and the newest user turns', () => {
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: 'old '.repeat(2000) },
      { role: 'assistant' as const, content: 'old answer '.repeat(2000) },
      { role: 'user' as const, content: 'newest' },
    ]
    const windowed = slideConversationWindow(messages, 80)
    expect(windowed[0]?.role).toBe('system')
    expect(windowed.at(-1)?.content).toBe('newest')
    expect(windowed.some((message) => message.content.startsWith('old '))).toBe(false)
  })
})

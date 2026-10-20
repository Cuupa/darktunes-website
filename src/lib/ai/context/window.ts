import { estimateTokens } from '@/lib/ai/budget/estimator'
import type { AiChatMessage } from '@/lib/ai/types/provider'

const DEFAULT_CONTEXT_BUDGET = 6000

export function slideConversationWindow(
  messages: AiChatMessage[],
  maxTokens = DEFAULT_CONTEXT_BUDGET,
): AiChatMessage[] {
  const system = messages.filter((message) => message.role === 'system')
  const rest = messages.filter((message) => message.role !== 'system')
  const kept: AiChatMessage[] = []
  let used = system.reduce((sum, message) => sum + estimateTokens(message.content), 0)
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const message = rest[i]
    if (!message) continue
    const cost = estimateTokens(message.content) + 6
    if (used + cost > maxTokens && kept.length > 0) break
    kept.unshift(message)
    used += cost
  }
  return [...system, ...kept]
}

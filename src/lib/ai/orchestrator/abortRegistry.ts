const controllers = new Map<string, AbortController>()

export function beginAiTurn(requestId: string): AbortController {
  abortAiTurn(requestId)
  const controller = new AbortController()
  controllers.set(requestId, controller)
  return controller
}

export function abortAiTurn(requestId: string): boolean {
  const existing = controllers.get(requestId)
  if (!existing) return false
  existing.abort()
  controllers.delete(requestId)
  return true
}

export function endAiTurn(requestId: string): void {
  controllers.delete(requestId)
}

export function conversationTurnKey(conversationId: string): string {
  return `conversation:${conversationId}`
}

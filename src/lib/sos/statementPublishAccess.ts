/**
 * Publishing a statement is a financial mutation — admin only (contract §D).
 * Kept as a pure helper so the server action and tests share one rule.
 */
export function canPublishStatement(role: string | null | undefined): boolean {
  return role === 'admin'
}

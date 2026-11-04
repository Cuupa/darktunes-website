/** Only an uninstalled schema may disable the not-yet-activated credit feature. */
export function isMissingAiCreditSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === 'PGRST205' || code === '42P01'
}

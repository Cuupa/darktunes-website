/** Derives a compact brand label from the full label name (first word). */
export function deriveShortName(labelName: string): string {
  const trimmed = labelName.trim()
  if (!trimmed) return 'Label'
  const [first] = trimmed.split(/\s+/)
  return first || 'Label'
}
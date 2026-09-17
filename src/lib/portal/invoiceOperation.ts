import { createHash } from 'crypto'

/**
 * Durable invoice-operation identity (#621). The operation id is provided by
 * the client once per submission attempt and reused on retries; the payload
 * hash makes "same operation, different request" a conflict instead of a
 * silent second document.
 */

export type InvoiceOperationReplay = 'none' | 'replay' | 'conflict'

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** Order-independent SHA-256 of the normalized invoice request. */
export function hashInvoicePayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

/**
 * Decides how to handle an existing operation row:
 * - `none`: no row (or a failed/incomplete row) → continue the normal flow.
 * - `replay`: same payload and a stored invoice id → return that invoice.
 * - `conflict`: same operation id with a different payload → 409.
 */
export function decideInvoiceOperationReplay(
  existing: { payloadHash: string; invoiceId?: string } | null,
  payloadHash: string,
): InvoiceOperationReplay {
  if (!existing) return 'none'
  if (existing.payloadHash !== payloadHash) return 'conflict'
  return existing.invoiceId ? 'replay' : 'none'
}

/**
 * Client-side fetch helpers for Settlement Center admin routes.
 * Keeps useSettlementCenter focused on UI state; token is passed in for testability.
 */

import type { SettlementRegister } from '@/lib/api/settlementRegister'

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

function readApiError(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && 'error' in json) {
    const message = (json as { error?: unknown }).error
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}

function authHeaders(token: string, json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

export async function fetchSettlementRegister(
  token: string,
  periodStart: string,
  periodEnd: string,
  fallbackError: string,
): Promise<SettlementRegister> {
  const params = new URLSearchParams({ periodStart, periodEnd })
  const response = await fetch(`/api/admin/settlements/register?${params}`, {
    headers: authHeaders(token),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
  return json as SettlementRegister
}

export async function bulkApproveStatements(
  token: string,
  ids: string[],
  notes: string | undefined,
  fallbackError: string,
): Promise<{ approved?: number; emailed?: number }> {
  const response = await fetch('/api/admin/sales-statements/bulk-approve', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ ids, notes }),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
  return (json ?? {}) as { approved?: number; emailed?: number }
}

export async function markInvoiceReceived(
  token: string,
  invoiceId: string,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(`/api/admin/invoices/${invoiceId}/received`, {
    method: 'PATCH',
    headers: authHeaders(token),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
}

export type RecordInvoicePaymentInput = {
  amountCents: number
  paymentMethod: string
  paymentReference?: string
  idempotencyKey?: string
}

export async function recordInvoicePayment(
  token: string,
  invoiceId: string,
  input: RecordInvoicePaymentInput,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(`/api/admin/invoices/${invoiceId}/payment`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
}

export async function lockSettlementPeriod(
  token: string,
  periodId: string,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(`/api/admin/settlements/periods/${periodId}/lock`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
}

export type CreateStatementCorrectionInput = {
  amountEur: number
  pdfBase64: string
  labelNotes?: string
}

export async function createStatementCorrection(
  token: string,
  statementId: string,
  input: CreateStatementCorrectionInput,
  fallbackError: string,
): Promise<{ statement?: { id: string } }> {
  const response = await fetch(`/api/admin/sales-statements/${statementId}/correction`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      amount_eur: input.amountEur,
      pdf_base64: input.pdfBase64,
      label_notes: input.labelNotes,
    }),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
  return (json ?? {}) as { statement?: { id: string } }
}

export async function archiveSettlementPeriod(
  token: string,
  periodId: string,
  nextPeriodStart: string,
  nextPeriodEnd: string,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(`/api/admin/settlements/periods/${periodId}/archive`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ nextPeriodStart, nextPeriodEnd }),
  })
  const json = await readJson(response)
  if (!response.ok) {
    throw new Error(readApiError(json, fallbackError))
  }
}
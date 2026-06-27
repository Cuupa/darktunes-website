/**
 * src/lib/zammad/submitTicket.ts
 *
 * Orchestrates Zammad ticket submission with deduplication, known-error
 * filtering, and local audit logging. Never throws — all failures are silent.
 */

import { createZammadTicket } from './client'
import { getZammadConfig } from './config'
import {
  formatAutoErrorBody,
  formatAutoErrorTitle,
  formatManualTicketBody,
  formatManualTicketTitle,
} from './formatTicket'
import { buildErrorFingerprint } from './fingerprint'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  hasRecentDuplicateTicket,
  insertTicketLog,
  isKnownErrorFingerprint,
} from '@/lib/api/zammadSupport'
import type { TicketLogStatus } from '@/lib/api/zammadSupport'
import type { Database } from '@/types/database'

export interface SubmitManualTicketInput {
  userId: string
  customerEmail: string
  customerName: string
  subject: string
  message: string
}

export interface SubmitAutoErrorTicketInput {
  userId: string
  customerEmail: string
  customerName: string
  source: string
  message: string
  viewPath?: string | null
  details?: Record<string, unknown>
}

async function getServiceDb(): Promise<SupabaseClient<Database> | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const { createClient } = await import('@supabase/supabase-js')
  return createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

async function logTicketAttempt(
  row: {
    fingerprint?: string | null
    ticketType: 'manual' | 'auto_error'
    status: TicketLogStatus
    zammadTicketId?: number | null
    userId: string
    customerEmail: string
    customerName: string
    title: string
    viewPath?: string | null
    errorSource?: string | null
    errorMessage?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const db = await getServiceDb()
    if (!db) return

    await insertTicketLog(db, {
      fingerprint: row.fingerprint ?? null,
      ticket_type: row.ticketType,
      status: row.status,
      zammad_ticket_id: row.zammadTicketId ?? null,
      user_id: row.userId,
      customer_email: row.customerEmail,
      customer_name: row.customerName,
      title: row.title,
      view_path: row.viewPath ?? null,
      error_source: row.errorSource ?? null,
      error_message: row.errorMessage ?? null,
      details: row.details ?? {},
    })
  } catch {
    // Audit logging must never surface errors
  }
}

async function submitToZammad(
  input: {
    ticketType: 'manual' | 'auto_error'
    userId: string
    customerEmail: string
    customerName: string
    title: string
    articleSubject: string
    articleBody: string
    fingerprint?: string | null
    viewPath?: string | null
    errorSource?: string | null
    errorMessage?: string | null
    details?: Record<string, unknown>
    skipDedup?: boolean
  },
): Promise<void> {
  const config = getZammadConfig()
  if (!config) {
    await logTicketAttempt({
      ...input,
      status: 'blocked_unconfigured',
    })
    return
  }

  if (input.fingerprint && !input.skipDedup) {
    try {
      const db = await getServiceDb()
      if (db) {
        if (await isKnownErrorFingerprint(db, input.fingerprint)) {
          await logTicketAttempt({ ...input, status: 'blocked_known' })
          return
        }
        if (await hasRecentDuplicateTicket(db, input.fingerprint, input.userId)) {
          await logTicketAttempt({ ...input, status: 'blocked_duplicate' })
          return
        }
      } else {
        // Cannot verify dedup without DB — skip submission to avoid ticket floods
        await logTicketAttempt({ ...input, status: 'skipped' })
        return
      }
    } catch {
      await logTicketAttempt({ ...input, status: 'skipped' })
      return
    }
  }

  try {
    const result = await createZammadTicket(config, {
      title: input.title,
      group: config.group,
      customerEmail: input.customerEmail,
      articleSubject: input.articleSubject,
      articleBody: input.articleBody,
    })

    await logTicketAttempt({
      ...input,
      status: 'sent',
      zammadTicketId: result.ticketId,
    })
  } catch {
    await logTicketAttempt({
      ...input,
      status: 'failed',
    })
  }
}

export function submitManualTicket(input: SubmitManualTicketInput): void {
  const title = formatManualTicketTitle(input.subject)
  const body = formatManualTicketBody(input.customerName, input.customerEmail, input.message)

  void submitToZammad({
    ticketType: 'manual',
    userId: input.userId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    title,
    articleSubject: input.subject.trim().slice(0, 200),
    articleBody: body,
    skipDedup: true,
    details: { subject: input.subject },
  })
}

export function submitAutoErrorTicket(input: SubmitAutoErrorTicketInput): void {
  const fingerprint = buildErrorFingerprint(input.source, input.message, input.viewPath)
  const title = formatAutoErrorTitle(input.source, input.message)
  const body = formatAutoErrorBody({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    source: input.source,
    message: input.message,
    viewPath: input.viewPath,
    details: input.details,
  })

  void submitToZammad({
    ticketType: 'auto_error',
    userId: input.userId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    title,
    articleSubject: title,
    articleBody: body,
    fingerprint,
    viewPath: input.viewPath,
    errorSource: input.source,
    errorMessage: input.message,
    details: input.details,
  })
}
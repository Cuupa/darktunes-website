import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createZammadTicket } from '@/lib/zammad/client'
import { getZammadConfig } from '@/lib/zammad/config'
import { hasRecentDuplicateTicket, isKnownErrorFingerprint, resolveUserProfile } from '@/lib/api/zammadSupport'

type Db = SupabaseClient<Database>

export async function enqueueZammadOutbox(
  db: Db,
  input: {
    userId: string
    subject: string
    message: string
    fingerprint: string | null
  },
): Promise<void> {
  const idempotencyKey = input.fingerprint
    ? `ai-zammad:${input.fingerprint}`
    : `ai-zammad:${input.userId}:${input.subject}:${input.message.slice(0, 40)}`
  const { error } = await db.from('integration_outbox').insert({
    target: 'zammad',
    status: 'pending',
    attempts: 0,
    next_retry_at: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    payload: {
      user_id: input.userId,
      subject: input.subject,
      message: input.message,
      fingerprint: input.fingerprint,
    },
  })
  if (error && !/duplicate|unique/i.test(error.message)) throw error
}

export async function drainZammadOutbox(db: Db, limit = 5): Promise<number> {
  const { data, error } = await db
    .from('integration_outbox')
    .select('*')
    .eq('target', 'zammad')
    .in('status', ['pending', 'failed', 'sending'])
    .lte('next_retry_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error || !data) return 0

  const config = getZammadConfig()
  let sent = 0
  for (const row of data) {
    const { data: claimed, error: claimError } = await db
      .from('integration_outbox')
      .update({
        status: 'sending',
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .in('status', ['pending', 'failed', 'sending'])
      .lte('next_retry_at', new Date().toISOString())
      .select('id')
    if (claimError || !claimed?.length) continue

    const payload = (row.payload ?? {}) as {
      user_id?: string
      subject?: string
      message?: string
      fingerprint?: string | null
    }
    const fingerprint = payload.fingerprint ?? null
    try {
      if (fingerprint) {
        if (await isKnownErrorFingerprint(db, fingerprint)) {
          await db
            .from('integration_outbox')
            .update({ status: 'sent', result_ref: 'blocked_known', updated_at: new Date().toISOString() })
            .eq('id', row.id)
          continue
        }
        if (payload.user_id && (await hasRecentDuplicateTicket(db, fingerprint, payload.user_id))) {
          await db
            .from('integration_outbox')
            .update({ status: 'sent', result_ref: 'blocked_duplicate', updated_at: new Date().toISOString() })
            .eq('id', row.id)
          continue
        }
      }
      if (!config) {
        throw new Error('Zammad is not configured')
      }
      const profile = payload.user_id
        ? await resolveUserProfile(db, payload.user_id)
        : { email: 'unknown@unknown', name: 'Assistant' }
      const result = await createZammadTicket(config, {
        title: (payload.subject ?? 'Assistant report').slice(0, 200),
        group: config.group,
        customerEmail: profile.email,
        articleSubject: (payload.subject ?? 'Assistant report').slice(0, 200),
        articleBody: payload.message ?? '',
      })
      await db
        .from('integration_outbox')
        .update({
          status: 'sent',
          result_ref: String(result.ticketId),
          attempts: row.attempts + 1,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      sent += 1
    } catch (err) {
      const attempts = row.attempts + 1
      const delayMs = Math.min(30 * 60 * 1000, 15_000 * 2 ** Math.min(attempts, 6))
      await db
        .from('integration_outbox')
        .update({
          status: attempts >= 8 ? 'failed' : 'pending',
          attempts,
          last_error: err instanceof Error ? err.message.slice(0, 400) : 'send failed',
          next_retry_at: new Date(Date.now() + delayMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }
  }
  return sent
}

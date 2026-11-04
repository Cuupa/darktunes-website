import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>
type EventRow = {
  user_id: string; model: string; input_tokens: number; output_tokens: number
  reasoning_tokens: number; total_tokens: number; success: boolean
  error_code: string | null; created_at: string
}
type Total = { input_tokens: number; output_tokens: number; reasoning_tokens: number; total_tokens: number; calls: number; failed: number }

const MAX_EVENTS = 5000
const emptyTotal = (): Total => ({ input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, total_tokens: 0, calls: 0, failed: 0 })
function summarize(rows: EventRow[]): Total {
  return rows.reduce((acc, row) => {
    acc.input_tokens += row.input_tokens
    acc.output_tokens += row.output_tokens
    acc.reasoning_tokens += row.reasoning_tokens
    acc.total_tokens += row.total_tokens
    acc.calls++
    if (!row.success) acc.failed++
    return acc
  }, emptyTotal())
}

/** Temporary compatibility path, only when the new SQL summary RPC does not exist. */
export async function loadLegacyAiUsageSummary(db: Db, dayStart: string, monthStart: string) {
  const { data, error } = await db.from('ai_usage_events')
    .select('user_id, model, input_tokens, output_tokens, reasoning_tokens, total_tokens, success, error_code, created_at')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS)
  if (error) throw error
  const rows = (data ?? []) as EventRow[]
  const roles = new Map<string, string>()
  const unique = [...new Set(rows.map(row => row.user_id).filter(Boolean))]
  for (let i = 0; i < unique.length; i += 500) {
    const { data: users, error: usersError } = await db.from('users')
      .select('id, role').in('id', unique.slice(i, i + 500))
    if (usersError) throw usersError
    for (const user of users ?? []) roles.set(user.id, user.role)
  }
  const byModel = new Map<string, {
    model: string; input_tokens: number; output_tokens: number; reasoning_tokens: number
    total_tokens: number; calls: number; failures: number
  }>()
  const byRole = new Map<string, { role: string; total_tokens: number; calls: number }>()
  const byDay = new Map<string, {
    date: string; input_tokens: number; output_tokens: number; reasoning_tokens: number
    total_tokens: number; failures: number
  }>()
  const byCode = new Map<string, number>()
  for (const row of rows) {
    const model = byModel.get(row.model) ?? {
      model: row.model, input_tokens: 0, output_tokens: 0,
      reasoning_tokens: 0, total_tokens: 0, calls: 0, failures: 0,
    }
    model.input_tokens += row.input_tokens
    model.output_tokens += row.output_tokens
    model.reasoning_tokens += row.reasoning_tokens
    model.total_tokens += row.total_tokens
    model.calls++
    if (!row.success) model.failures++
    byModel.set(row.model, model)

    const role = roles.get(row.user_id) ?? 'unknown'
    const roleTotal = byRole.get(role) ?? { role, total_tokens: 0, calls: 0 }
    roleTotal.total_tokens += row.total_tokens
    roleTotal.calls++
    byRole.set(role, roleTotal)

    const dayId = row.created_at.slice(0, 10)
    const day = byDay.get(dayId) ?? {
      date: dayId, input_tokens: 0, output_tokens: 0,
      reasoning_tokens: 0, total_tokens: 0, failures: 0,
    }
    day.input_tokens += row.input_tokens
    day.output_tokens += row.output_tokens
    day.reasoning_tokens += row.reasoning_tokens
    day.total_tokens += row.total_tokens
    if (!row.success) {
      day.failures++
      const code = row.error_code ?? 'UNKNOWN'
      byCode.set(code, (byCode.get(code) ?? 0) + 1)
    }
    byDay.set(dayId, day)
  }
  return {
    summary: {
      today: summarize(rows.filter(row => row.created_at >= dayStart)),
      month: summarize(rows),
      by_model: [...byModel.values()].sort((a, b) => b.total_tokens - a.total_tokens),
      by_role: [...byRole.values()].sort((a, b) => b.total_tokens - a.total_tokens),
      by_day: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      failures: {
        count: [...byCode.values()].reduce((sum, count) => sum + count, 0),
        by_code: [...byCode.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
      },
    },
    truncated: rows.length >= MAX_EVENTS,
  }
}

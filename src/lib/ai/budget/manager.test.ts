import { describe, expect, it, vi } from 'vitest'
import { TokenBudgetManager } from '@/lib/ai/budget/manager'
import { DEFAULT_TOKEN_LIMITS } from '@/lib/ai/budget/limits'
import { ApiError } from '@/lib/errors'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function mockDb(rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn(rpcImpl),
  } as unknown as SupabaseClient<Database>
}

const baseInput = {
  requestId: 'req-budget-1',
  userId: 'user-1',
  role: 'artist' as const,
  modelRole: 'fast' as const,
  estimatedInputTokens: 200,
  estimatedOutputTokens: 100,
  now: new Date('2026-10-20T12:00:00.000Z'),
}

describe('TokenBudgetManager', () => {
  it('should reject input that exceeds the per-call input cap before hitting the database', async () => {
    const db = mockDb(async () => ({ data: { ok: true }, error: null }))
    const manager = new TokenBudgetManager(db, {
      ...DEFAULT_TOKEN_LIMITS,
      roles: { ...DEFAULT_TOKEN_LIMITS.roles },
      fast: { ...DEFAULT_TOKEN_LIMITS.fast },
      reasoning: { ...DEFAULT_TOKEN_LIMITS.reasoning },
      global: { ...DEFAULT_TOKEN_LIMITS.global },
      max_tool_rounds: { ...DEFAULT_TOKEN_LIMITS.max_tool_rounds },
    })
    await expect(
      manager.reserve({ ...baseInput, estimatedInputTokens: 20_000 }),
    ).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED', status: 429 } satisfies Partial<ApiError>)
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('should reserve across global and user scopes', async () => {
    const db = mockDb(async () => ({ data: { ok: true }, error: null }))
    const manager = new TokenBudgetManager(db, {
      ...DEFAULT_TOKEN_LIMITS,
      roles: { ...DEFAULT_TOKEN_LIMITS.roles },
      fast: { ...DEFAULT_TOKEN_LIMITS.fast },
      reasoning: { ...DEFAULT_TOKEN_LIMITS.reasoning },
      global: { ...DEFAULT_TOKEN_LIMITS.global },
      max_tool_rounds: { ...DEFAULT_TOKEN_LIMITS.max_tool_rounds },
    })
    const result = await manager.reserve(baseInput)
    expect(result.reserved).toBe(300)
    const [, args] = (db.rpc as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { p_items: unknown[] }]
    expect(args.p_items).toHaveLength(4)
    expect(args.p_items.map((item) => (item as { scope: string }).scope)).toEqual([
      'global',
      'global',
      'user',
      'user',
    ])
  })

  it('should map a failed RPC to AI_BUDGET_EXCEEDED', async () => {
    const db = mockDb(async () => ({
      data: { ok: false, code: 'AI_BUDGET_EXCEEDED', remaining: 10, needed: 300, scope: 'user' },
      error: null,
    }))
    const manager = new TokenBudgetManager(db, {
      ...DEFAULT_TOKEN_LIMITS,
      roles: { ...DEFAULT_TOKEN_LIMITS.roles },
      fast: { ...DEFAULT_TOKEN_LIMITS.fast },
      reasoning: { ...DEFAULT_TOKEN_LIMITS.reasoning },
      global: { ...DEFAULT_TOKEN_LIMITS.global },
      max_tool_rounds: { ...DEFAULT_TOKEN_LIMITS.max_tool_rounds },
    })
    await expect(manager.reserve(baseInput)).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' })
  })

  it('should settle unknown consumption as null so the RPC charges the reservation', async () => {
    const db = mockDb(async () => ({ data: { ok: true }, error: null }))
    const manager = new TokenBudgetManager(db, {
      ...DEFAULT_TOKEN_LIMITS,
      roles: { ...DEFAULT_TOKEN_LIMITS.roles },
      fast: { ...DEFAULT_TOKEN_LIMITS.fast },
      reasoning: { ...DEFAULT_TOKEN_LIMITS.reasoning },
      global: { ...DEFAULT_TOKEN_LIMITS.global },
      max_tool_rounds: { ...DEFAULT_TOKEN_LIMITS.max_tool_rounds },
    })
    await manager.settle('req-budget-1', null)
    expect(db.rpc).toHaveBeenCalledWith('settle_ai_tokens', {
      p_request_id: 'req-budget-1',
      p_consumed: null,
    })
  })
})

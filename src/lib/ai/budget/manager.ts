import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError, buildApiError } from '@/lib/errors'
import { parseTokenLimits, startOfUtcDay, startOfUtcMonth, type TokenLimits } from '@/lib/ai/budget/limits'
import type { AiModelRole } from '@/lib/ai/types/provider'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>

export type BudgetRole = 'artist' | 'editor' | 'admin'

export interface ReserveBudgetInput {
  requestId: string
  userId: string
  role: BudgetRole
  modelRole: AiModelRole
  estimatedInputTokens: number
  estimatedOutputTokens: number
  limits?: TokenLimits
  now?: Date
}

export interface ReserveBudgetResult {
  reserved: number
  remaining_output: number
  remaining_turn: number
}

interface ReserveRpcResult {
  ok?: boolean
  code?: string
  scope?: string
  remaining?: number
  needed?: number
  detail?: string
}

const RESERVATION_TTL_MS = 3 * 60 * 1000

export class TokenBudgetManager {
  constructor(
    private readonly db: Db,
    private readonly limits: TokenLimits,
  ) {}

  static fromLimits(db: Db, rawLimits: unknown): TokenBudgetManager {
    return new TokenBudgetManager(db, parseTokenLimits(rawLimits))
  }

  async reserve(input: ReserveBudgetInput): Promise<ReserveBudgetResult> {
    const limits = input.limits ?? this.limits
    const model = input.modelRole === 'reasoning' ? limits.reasoning : limits.fast
    const estimatedInput = input.estimatedInputTokens
    const estimatedOutput = input.estimatedOutputTokens
    const turnTokens = estimatedInput + estimatedOutput

    if (estimatedInput > model.max_input_tokens) {
      throw budgetExceeded('input', model.max_input_tokens, estimatedInput)
    }
    if (estimatedOutput > model.max_output_tokens) {
      throw budgetExceeded('output', model.max_output_tokens, estimatedOutput)
    }
    if (turnTokens > model.max_turn_tokens) {
      throw budgetExceeded('turn', model.max_turn_tokens, turnTokens)
    }

    const now = input.now ?? new Date()
    const dayStart = startOfUtcDay(now).toISOString()
    const monthStart = startOfUtcMonth(now).toISOString()
    const roleLimits = limits.roles[input.role]
    const items = [
      scopeItem('global', '', 'day', dayStart, limits.global.day, turnTokens),
      scopeItem('global', '', 'month', monthStart, limits.global.month, turnTokens),
      scopeItem('user', input.userId, 'day', dayStart, roleLimits.day, turnTokens),
      scopeItem('user', input.userId, 'month', monthStart, roleLimits.month, turnTokens),
    ]

    const { data, error } = await this.db.rpc('reserve_ai_tokens', {
      p_request_id: input.requestId,
      p_items: items,
      p_expires_at: new Date(now.getTime() + RESERVATION_TTL_MS).toISOString(),
    })
    if (error) throw new ApiError(500, 'The token budget could not be reserved.', 'DB_ERROR')

    const result = data as ReserveRpcResult | null
    if (!result?.ok) {
      if (result?.code === 'AI_BUDGET_EXCEEDED') {
        throw budgetExceeded(result.scope ?? 'budget', result.remaining ?? 0, result.needed ?? turnTokens)
      }
      throw buildApiError('DB_ERROR', 500)
    }

    return {
      reserved: turnTokens,
      remaining_output: model.max_output_tokens - estimatedOutput,
      remaining_turn: model.max_turn_tokens - turnTokens,
    }
  }

  async settle(requestId: string, consumedTokens: number | null): Promise<void> {
    const { error } = await this.db.rpc('settle_ai_tokens', {
      p_request_id: requestId,
      p_consumed: consumedTokens,
    })
    if (error) throw new ApiError(500, 'The token budget could not be settled.', 'DB_ERROR')
  }
}

function scopeItem(
  scope: 'global' | 'role' | 'user',
  scopeId: string,
  period: 'day' | 'month',
  periodStart: string,
  tokenLimit: number,
  tokens: number,
) {
  return {
    scope,
    scope_id: scopeId,
    period,
    period_start: periodStart,
    token_limit: tokenLimit,
    tokens,
  }
}

function budgetExceeded(scope: string, remaining: number, needed: number): ApiError {
  return new ApiError(
    429,
    `The AI ${scope} token budget is used up (${needed} needed, ${remaining} left). Wait for the next period or ask an admin to raise the limit.`,
    'AI_BUDGET_EXCEEDED',
  )
}

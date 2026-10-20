import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AiUsage } from '@/lib/ai/types/provider'

type Db = SupabaseClient<Database>

export async function insertAiUsageEvent(
  db: Db,
  row: {
    userId: string
    artistId?: string | null
    conversationId?: string | null
    requestId: string
    model: string
    usage: AiUsage
    usageSource: 'provider' | 'estimate' | 'settlement'
    operationType: string
  },
): Promise<void> {
  const { error } = await db.from('ai_usage_events').insert({
    user_id: row.userId,
    artist_id: row.artistId ?? null,
    conversation_id: row.conversationId ?? null,
    request_id: row.requestId,
    model: row.model,
    input_tokens: row.usage.input_tokens,
    output_tokens: row.usage.output_tokens,
    reasoning_tokens: row.usage.reasoning_tokens,
    total_tokens: row.usage.total_tokens,
    usage_source: row.usageSource,
    operation_type: row.operationType,
  })
  if (error) throw error
}

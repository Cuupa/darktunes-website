import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { DEFAULT_LABEL_ID } from '@/lib/api/apiCredentials'
import { DEFAULT_TOKEN_LIMITS, parseTokenLimits, type TokenLimits } from '@/lib/ai/budget/limits'

type Db = SupabaseClient<Database>
type SettingsRow = Database['public']['Tables']['ai_settings']['Row']

export interface AiSettings {
  enabled: boolean
  testMode: boolean
  provider: string
  modelFast: string
  modelReasoning: string
  defaultStreaming: boolean
  tokenLimits: TokenLimits
  reasoningSettings: Record<string, unknown>
  featureFlags: Record<string, unknown>
  timeouts: Record<string, unknown>
  maxToolRounds: number
  providerCapabilities: Record<string, unknown>
  lastConnectionTest: Record<string, unknown> | null
  updatedAt: string
  updatedBy: string | null
}

function rowToSettings(row: SettingsRow): AiSettings {
  return {
    enabled: row.enabled,
    testMode: row.test_mode,
    provider: row.provider,
    modelFast: row.model_fast,
    modelReasoning: row.model_reasoning,
    defaultStreaming: row.default_streaming,
    tokenLimits: parseTokenLimits(row.token_limits),
    reasoningSettings: row.reasoning_settings,
    featureFlags: row.feature_flags,
    timeouts: row.timeouts,
    maxToolRounds: row.max_tool_rounds,
    providerCapabilities: row.provider_capabilities,
    lastConnectionTest: row.last_connection_test,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export async function getAiSettings(db: Db): Promise<AiSettings> {
  const { data, error } = await db
    .from('ai_settings')
    .select('*')
    .eq('label_id', DEFAULT_LABEL_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    return {
      enabled: false,
      testMode: true,
      provider: 'nvidia',
      modelFast: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      modelReasoning: 'nvidia/nemotron-3-super-120b-a12b',
      defaultStreaming: true,
      tokenLimits: parseTokenLimits(DEFAULT_TOKEN_LIMITS),
      reasoningSettings: { fast_default: false, reasoning_default: true, low_effort: true },
      featureFlags: { artist: true, editor: true, admin: true },
      timeouts: { complete_ms: 45_000, stream_ms: 120_000 },
      maxToolRounds: 4,
      providerCapabilities: {},
      lastConnectionTest: null,
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    }
  }
  return rowToSettings(data)
}

export async function updateAiSettings(
  db: Db,
  patch: Database['public']['Tables']['ai_settings']['Update'],
): Promise<AiSettings> {
  const { data, error } = await db
    .from('ai_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('label_id', DEFAULT_LABEL_ID)
    .select('*')
    .single()
  if (error) throw error
  return rowToSettings(data)
}

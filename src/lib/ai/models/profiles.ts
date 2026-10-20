import {
  DEFAULT_AI_MODELS,
  type AiModelRole,
  type ModelCapabilities,
} from '@/lib/ai/types/provider'

export const FAST_MODEL_ID = DEFAULT_AI_MODELS.fast
export const REASONING_MODEL_ID = DEFAULT_AI_MODELS.reasoning

const FAST_PROFILE: ModelCapabilities = {
  model_id: FAST_MODEL_ID,
  role: 'fast',
  supports_streaming: true,
  supports_tools: true,
  supports_tools_with_streaming: true,
  supports_enable_thinking: true,
  supports_low_effort: false,
  supports_reasoning_budget: false,
  reasoning_budget_path: 'none',
  default_temperature: 1,
  default_top_p: 0.95,
  max_output_tokens: 900,
}

const REASONING_PROFILE: ModelCapabilities = {
  model_id: REASONING_MODEL_ID,
  role: 'reasoning',
  supports_streaming: true,
  supports_tools: true,
  supports_tools_with_streaming: true,
  supports_enable_thinking: true,
  supports_low_effort: true,
  supports_reasoning_budget: false,
  reasoning_budget_path: 'none',
  default_temperature: 1,
  default_top_p: 0.95,
  max_output_tokens: 2500,
}

const PROFILES_BY_ID: Record<string, ModelCapabilities> = {
  [FAST_MODEL_ID]: FAST_PROFILE,
  [REASONING_MODEL_ID]: REASONING_PROFILE,
}

export function getModelProfile(modelId: string): ModelCapabilities {
  const known = PROFILES_BY_ID[modelId]
  if (known) return { ...known }
  return {
    ...FAST_PROFILE,
    model_id: modelId,
    role: inferRoleFromModelId(modelId),
  }
}

export function getModelProfileForRole(role: AiModelRole): ModelCapabilities {
  return role === 'reasoning' ? { ...REASONING_PROFILE } : { ...FAST_PROFILE }
}

export function inferRoleFromModelId(modelId: string): AiModelRole {
  if (modelId.includes('super') || modelId.includes('reasoning')) return 'reasoning'
  return 'fast'
}

export function mergeDiscoveredCapabilities(
  base: ModelCapabilities,
  discovered: Partial<Pick<
    ModelCapabilities,
    | 'supports_tools'
    | 'supports_tools_with_streaming'
    | 'supports_enable_thinking'
    | 'supports_low_effort'
    | 'supports_reasoning_budget'
    | 'reasoning_budget_path'
    | 'supports_streaming'
  >>,
): ModelCapabilities {
  return { ...base, ...discovered }
}

/** Fast-model simple turns keep thinking off so output tokens stay on the answer. */
export function shouldEnableThinking(role: AiModelRole, task: 'simple' | 'complex'): boolean {
  if (role === 'reasoning') return true
  return task === 'complex'
}

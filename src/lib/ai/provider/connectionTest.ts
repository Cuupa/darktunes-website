import { FAST_MODEL_ID, REASONING_MODEL_ID, getModelProfile, mergeDiscoveredCapabilities } from '@/lib/ai/models/profiles'
import { AiProviderError, isAiProviderError } from '@/lib/ai/provider/errors'
import { NvidiaOpenAiCompatibleProvider } from '@/lib/ai/provider/nvidia'
import type { AiProvider } from '@/lib/ai/provider/interface'
import type { AiProviderErrorCode, AiUsage, ModelCapabilities } from '@/lib/ai/types/provider'

export const CONNECTION_TEST_ECHO_TOOL = {
  name: 'echo_test',
  description: 'Return the provided ping string unchanged. Harmless connection-test tool.',
  parameters: {
    type: 'object',
    properties: { ping: { type: 'string' } },
    required: ['ping'],
  },
} as const

export type ConnectionTestStepId =
  | 'auth'
  | 'fast_complete'
  | 'reasoning_complete'
  | 'stream'
  | 'tool_call'
  | 'usage'

export interface ConnectionTestStepResult {
  step: ConnectionTestStepId
  ok: boolean
  latency_ms: number
  error_code: AiProviderErrorCode | null
  detail: string | null
}

export interface ConnectionTestResult {
  ok: boolean
  started_at: string
  finished_at: string
  total_latency_ms: number
  steps: ConnectionTestStepResult[]
  discovered_capabilities: Record<string, Partial<ModelCapabilities>>
  usage: { fast: AiUsage | null; reasoning: AiUsage | null }
}

const HARMLESS_USER_PROMPT = 'Reply with the single word pong.'

export async function runNvidiaConnectionTest(options: {
  apiKey: string
  provider?: AiProvider
  fetchImpl?: typeof fetch
  fastModel?: string
  reasoningModel?: string
}): Promise<ConnectionTestResult> {
  const started = Date.now()
  const startedAt = new Date(started).toISOString()
  const fastModel = options.fastModel?.trim() || FAST_MODEL_ID
  const reasoningModel = options.reasoningModel?.trim() || REASONING_MODEL_ID
  const provider =
    options.provider ??
    new NvidiaOpenAiCompatibleProvider({ apiKey: options.apiKey, fetchImpl: options.fetchImpl })
  const steps: ConnectionTestStepResult[] = []
  const discovered: Record<string, Partial<ModelCapabilities>> = {}
  const usage: ConnectionTestResult['usage'] = { fast: null, reasoning: null }

  const auth = await runStep('auth', async () => {
    const status = await provider.validateConfiguration()
    if (!status.configured) {
      throw new AiProviderError('INVALID_KEY', 'No NVIDIA API key is configured.')
    }
  })
  steps.push(auth)
  if (!auth.ok) return finish(false)

  const fast = await runStep('fast_complete', async () => {
    const completion = await provider.complete({
      request_id: 'connection-test-fast',
      model: fastModel,
      messages: [{ role: 'user', content: HARMLESS_USER_PROMPT }],
      max_tokens: 32,
      enable_thinking: false,
      timeout_ms: 20_000,
    })
    usage.fast = completion.usage
    if (!completion.content.trim()) {
      throw new AiProviderError('INVALID_RESPONSE', 'The fast model returned an empty answer.')
    }
    discovered[fastModel] = {
      supports_enable_thinking: true,
    }
  })
  steps.push(fast)
  if (!fast.ok) return finish(false)

  const reasoning = await runStep('reasoning_complete', async () => {
    try {
      const completion = await provider.complete({
        request_id: 'connection-test-reasoning',
        model: reasoningModel,
        messages: [{ role: 'user', content: HARMLESS_USER_PROMPT }],
        max_tokens: 64,
        enable_thinking: true,
        low_effort: true,
        timeout_ms: 40_000,
      })
      usage.reasoning = completion.usage
      discovered[reasoningModel] = {
        supports_enable_thinking: true,
        supports_low_effort: true,
      }
      if (!completion.content.trim() && !completion.reasoning_content) {
        throw new AiProviderError('INVALID_RESPONSE', 'The reasoning model returned an empty answer.')
      }
    } catch (error) {
      if (isAiProviderError(error) && error.code === 'INVALID_RESPONSE') {
        const retry = await provider.complete({
          request_id: 'connection-test-reasoning-plain',
          model: reasoningModel,
          messages: [{ role: 'user', content: HARMLESS_USER_PROMPT }],
          max_tokens: 64,
          enable_thinking: false,
          timeout_ms: 40_000,
        })
        usage.reasoning = retry.usage
        discovered[reasoningModel] = {
          ...(discovered[reasoningModel] ?? {}),
          supports_low_effort: false,
        }
        return
      }
      throw error
    }
  })
  steps.push(reasoning)
  if (!reasoning.ok) return finish(false)

  const stream = await runStep('stream', async () => {
    let sawDelta = false
    for await (const event of provider.stream({
      request_id: 'connection-test-stream',
      model: fastModel,
      messages: [{ role: 'user', content: HARMLESS_USER_PROMPT }],
      max_tokens: 24,
      enable_thinking: false,
      timeout_ms: 20_000,
    })) {
      if (event.type === 'delta' && event.text.length > 0) sawDelta = true
    }
    discovered[fastModel] = {
      ...(discovered[fastModel] ?? {}),
      supports_streaming: sawDelta,
    }
    if (!sawDelta) {
      throw new AiProviderError('INVALID_RESPONSE', 'The streaming test produced no text deltas.')
    }
  })
  steps.push(stream)
  if (!stream.ok) return finish(false)

  const tool = await runStep('tool_call', async () => {
    try {
      const completion = await provider.complete({
        request_id: 'connection-test-tool',
        model: fastModel,
        messages: [
          {
            role: 'user',
            content: 'Call echo_test with ping set to pong. Do not answer in prose.',
          },
        ],
        tools: [CONNECTION_TEST_ECHO_TOOL],
        max_tokens: 64,
        enable_thinking: false,
        timeout_ms: 20_000,
      })
      const supported = completion.tool_calls.some((call) => call.name === 'echo_test')
      discovered[fastModel] = {
        ...(discovered[fastModel] ?? {}),
        supports_tools: supported,
      }
      if (!supported) {
        throw new AiProviderError(
          'TOOL_CALL_UNSUPPORTED',
          'The fast model did not emit the echo_test tool call.',
        )
      }
    } catch (error) {
      if (isAiProviderError(error) && error.httpStatus === 400) {
        throw new AiProviderError('TOOL_CALL_UNSUPPORTED', 'NVIDIA rejected the tool-calling request.', {
          httpStatus: 400,
          cause: error,
        })
      }
      throw error
    }
  })
  steps.push(tool)

  const usageStep: ConnectionTestStepResult = {
    step: 'usage',
    ok: Boolean(usage.fast && usage.fast.total_tokens > 0),
    latency_ms: 0,
    error_code: usage.fast && usage.fast.total_tokens > 0 ? null : 'INVALID_RESPONSE',
    detail:
      usage.fast && usage.fast.total_tokens > 0
        ? null
        : 'NVIDIA did not return usage metadata on the fast-model call.',
  }
  steps.push(usageStep)

  const ok = steps.every((step) => step.ok)
  return finish(ok)

  function finish(ok: boolean): ConnectionTestResult {
    return {
      ok,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      total_latency_ms: Date.now() - started,
      steps,
      discovered_capabilities: discovered,
      usage,
    }
  }
}

async function runStep(
  step: ConnectionTestStepId,
  work: () => Promise<void>,
): Promise<ConnectionTestStepResult> {
  const started = Date.now()
  try {
    await work()
    return {
      step,
      ok: true,
      latency_ms: Date.now() - started,
      error_code: null,
      detail: null,
    }
  } catch (error) {
    const providerError = isAiProviderError(error)
      ? error
      : new AiProviderError('PROVIDER_UNAVAILABLE', 'The connection test failed unexpectedly.', {
          cause: error,
        })
    return {
      step,
      ok: false,
      latency_ms: Date.now() - started,
      error_code: providerError.code,
      detail: providerError.message,
    }
  }
}

export function capabilitiesAfterConnectionTest(
  result: ConnectionTestResult,
): Record<string, ModelCapabilities> {
  const out: Record<string, ModelCapabilities> = {}
  for (const modelId of Object.keys(result.discovered_capabilities)) {
    out[modelId] = mergeDiscoveredCapabilities(
      getModelProfile(modelId),
      result.discovered_capabilities[modelId] ?? {},
    )
  }
  return out
}

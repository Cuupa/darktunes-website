import { getModelProfile, mergeDiscoveredCapabilities } from '@/lib/ai/models/profiles'
import { AiProviderError, providerErrorFromHttpStatus, providerErrorFromNetwork } from '@/lib/ai/provider/errors'
import type { AiProvider } from '@/lib/ai/provider/interface'
import { mergeToolCallDeltas, parseSseBlock, parseUsage } from '@/lib/ai/provider/sse'
import {
  EMPTY_AI_USAGE,
  NVIDIA_CHAT_COMPLETIONS_URL,
  type AiCompletion,
  type AiCompletionRequest,
  type AiStreamEvent,
  type AiToolCall,
  type ModelCapabilities,
  type ProviderConfigStatus,
} from '@/lib/ai/types/provider'

export interface NvidiaProviderOptions {
  apiKey: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  discoveredCapabilities?: Record<string, Partial<ModelCapabilities>>
}

const DEFAULT_TIMEOUT_MS = 45_000

export class NvidiaOpenAiCompatibleProvider implements AiProvider {
  readonly id = 'nvidia' as const
  private readonly apiKey: string
  private readonly completionsUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly discovered: Record<string, Partial<ModelCapabilities>>
  private readonly controllers = new Map<string, AbortController>()

  constructor(options: NvidiaProviderOptions) {
    this.apiKey = options.apiKey
    const base = (options.baseUrl ?? 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')
    this.completionsUrl = `${base}/chat/completions`
    this.fetchImpl = options.fetchImpl ?? fetch
    this.discovered = options.discoveredCapabilities ?? {}
  }

  getCapabilities(modelId: string): ModelCapabilities {
    return mergeDiscoveredCapabilities(getModelProfile(modelId), this.discovered[modelId] ?? {})
  }

  getUsage(completion: AiCompletion) {
    return completion.usage
  }

  async validateConfiguration(): Promise<ProviderConfigStatus> {
    return {
      configured: this.apiKey.trim().length > 0,
      provider: 'nvidia',
      base_url: this.completionsUrl.replace(/\/chat\/completions$/, ''),
      models: {
        fast: getModelProfile('nvidia/nemotron-3.5-lightning-30b-a3b').model_id,
        reasoning: getModelProfile('nvidia/nemotron-3-super-120b-a12b').model_id,
      },
    }
  }

  abort(requestId: string): void {
    const controller = this.controllers.get(requestId)
    controller?.abort()
    this.controllers.delete(requestId)
  }

  async complete(request: AiCompletionRequest, signal?: AbortSignal): Promise<AiCompletion> {
    const started = Date.now()
    const { response, cleanup } = await this.send(request, false, signal)
    try {
      const text = await response.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA returned a non-JSON chat completion.', {
          httpStatus: response.status,
        })
      }
      return this.completionFromResponse(request, parsed, Date.now() - started)
    } finally {
      cleanup()
    }
  }

  async *stream(request: AiCompletionRequest, signal?: AbortSignal): AsyncIterable<AiStreamEvent> {
    const started = Date.now()
    const { response, cleanup } = await this.send(request, true, signal)
    const body = response.body
    if (!body) {
      cleanup()
      throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA returned an empty stream body.', {
        httpStatus: response.status,
      })
    }

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    let reasoning = ''
    let toolCalls: AiToolCall[] = []
    let finishReason: AiCompletion['finish_reason'] = 'unknown'
    let usage = EMPTY_AI_USAGE

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const chunk = parseSseBlock(frame)
          if (!chunk) continue
          if (chunk.done) {
            const completion = this.buildCompletion(request, content, reasoning, toolCalls, finishReason, usage, Date.now() - started)
            yield { type: 'done', completion }
            return
          }
          if (chunk.contentDelta) {
            content += chunk.contentDelta
            yield { type: 'delta', text: chunk.contentDelta }
          }
          if (chunk.reasoningDelta) {
            reasoning += chunk.reasoningDelta
            yield { type: 'reasoning_delta', text: chunk.reasoningDelta }
          }
          if (chunk.toolCallDeltas.length > 0) {
            toolCalls = mergeToolCallDeltas(toolCalls, chunk.toolCallDeltas)
            for (const delta of chunk.toolCallDeltas) {
              yield { type: 'tool_call_delta', tool_call: delta }
            }
          }
          if (chunk.usage) {
            usage = chunk.usage
            yield { type: 'usage', usage }
          }
          if (chunk.finishReason) {
            finishReason = normalizeFinishReason(chunk.finishReason)
          }
        }
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error
      throw providerErrorFromNetwork(error)
    } finally {
      cleanup()
      reader.releaseLock()
    }

    const completion = this.buildCompletion(
      request,
      content,
      reasoning,
      toolCalls,
      finishReason,
      usage,
      Date.now() - started,
    )
    yield { type: 'done', completion }
  }

  private async send(
    request: AiCompletionRequest,
    stream: boolean,
    outerSignal?: AbortSignal,
  ): Promise<{ response: Response; cleanup: () => void }> {
    const controller = new AbortController()
    this.controllers.set(request.request_id, controller)
    const timeoutMs = request.timeout_ms ?? DEFAULT_TIMEOUT_MS
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    outerSignal?.addEventListener('abort', onAbort)
    if (outerSignal?.aborted) controller.abort()

    // Keep cancellation and timeouts active until the response body is consumed.
    // A successful HTTP handshake does not mean a streamed completion has finished.
    const cleanup = () => {
      clearTimeout(timeout)
      outerSignal?.removeEventListener('abort', onAbort)
      if (this.controllers.get(request.request_id) === controller) {
        this.controllers.delete(request.request_id)
      }
    }

    try {
      const response = await this.fetchImpl(this.completionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: stream ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify(buildNvidiaPayload(request, stream, this.getCapabilities(request.model))),
        signal: controller.signal,
      })
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        throw providerErrorFromHttpStatus(
          response.status,
          bodyText,
          response.headers.get('retry-after'),
        )
      }
      return { response, cleanup }
    } catch (error) {
      cleanup()
      if (error instanceof AiProviderError) throw error
      throw providerErrorFromNetwork(error)
    }
  }

  private completionFromResponse(
    request: AiCompletionRequest,
    parsed: unknown,
    latencyMs: number,
  ): AiCompletion {
    if (!parsed || typeof parsed !== 'object') {
      throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA returned an empty completion object.')
    }
    const record = parsed as {
      choices?: Array<{
        message?: {
          content?: unknown
          reasoning_content?: unknown
          reasoning?: unknown
          tool_calls?: Array<{ id?: unknown; function?: { name?: unknown; arguments?: unknown } }>
        }
        finish_reason?: unknown
      }>
      usage?: unknown
    }
    const choice = record.choices?.[0]
    if (!choice) {
      throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA returned no completion choices.')
    }
    const message = choice.message ?? {}
    const toolCalls: AiToolCall[] = []
    for (const call of message.tool_calls ?? []) {
      toolCalls.push({
        id: typeof call.id === 'string' ? call.id : '',
        name: typeof call.function?.name === 'string' ? call.function.name : '',
        arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : '{}',
      })
    }
    const content = typeof message.content === 'string' ? message.content : ''
    const reasoning =
      typeof message.reasoning_content === 'string'
        ? message.reasoning_content
        : typeof message.reasoning === 'string'
          ? message.reasoning
          : null
    return this.buildCompletion(
      request,
      content,
      reasoning,
      toolCalls,
      normalizeFinishReason(typeof choice.finish_reason === 'string' ? choice.finish_reason : null),
      parseUsage(record.usage) ?? EMPTY_AI_USAGE,
      latencyMs,
    )
  }

  private buildCompletion(
    request: AiCompletionRequest,
    content: string,
    reasoning: string | null,
    toolCalls: AiToolCall[],
    finishReason: AiCompletion['finish_reason'],
    usage: AiCompletion['usage'],
    latencyMs: number,
  ): AiCompletion {
    return {
      request_id: request.request_id,
      model: request.model,
      content,
      reasoning_content: reasoning && reasoning.length > 0 ? reasoning : null,
      tool_calls: toolCalls.filter((call) => call.name.length > 0),
      finish_reason: toolCalls.some((call) => call.name) ? 'tool_calls' : finishReason,
      usage,
      latency_ms: latencyMs,
    }
  }
}

/**
 * Translate internal tool calls into OpenAI-compatible chat message objects.
 * NVIDIA rejects the flattened internal { name, arguments } tool-call shape.
 */
export function serializeNvidiaMessages(messages: AiCompletionRequest['messages']): Record<string, unknown>[] {
  return messages.map((message) => {
    const serialized: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    }
    if (message.role === 'tool') {
      if (!message.tool_call_id) {
        throw new AiProviderError('INVALID_RESPONSE', 'A tool reply is missing its tool_call_id.')
      }
      serialized.tool_call_id = message.tool_call_id
    }
    if (message.role === 'assistant' && message.tool_calls?.length) {
      serialized.tool_calls = message.tool_calls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      }))
    }
    return serialized
  })
}

export function buildNvidiaPayload(
  request: AiCompletionRequest,
  stream: boolean,
  capabilities: ModelCapabilities,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: serializeNvidiaMessages(request.messages),
    temperature: request.temperature ?? capabilities.default_temperature,
    top_p: request.top_p ?? capabilities.default_top_p,
    max_tokens: request.max_tokens,
    stream,
  }
  if (request.tools && request.tools.length > 0) {
    if (request.tool_choice) payload.tool_choice = request.tool_choice
    payload.tools = request.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  const template: Record<string, unknown> = {}
  if (capabilities.supports_enable_thinking && request.enable_thinking !== undefined) {
    template.enable_thinking = request.enable_thinking
  }
  if (capabilities.supports_low_effort && request.low_effort) {
    template.low_effort = true
  }
  if (Object.keys(template).length > 0) {
    payload.chat_template_kwargs = template
  }

  if (capabilities.supports_reasoning_budget && typeof request.reasoning_budget === 'number') {
    if (capabilities.reasoning_budget_path === 'top_level') {
      payload.reasoning_budget = request.reasoning_budget
    } else if (capabilities.reasoning_budget_path === 'chat_template_kwargs') {
      payload.chat_template_kwargs = {
        ...(typeof payload.chat_template_kwargs === 'object' && payload.chat_template_kwargs
          ? payload.chat_template_kwargs
          : {}),
        reasoning_budget: request.reasoning_budget,
      }
    } else if (capabilities.reasoning_budget_path === 'custom_params') {
      payload.custom_params = { thinking_budget: request.reasoning_budget }
    }
  }

  return payload
}

function normalizeFinishReason(reason: string | null): AiCompletion['finish_reason'] {
  if (reason === 'stop' || reason === 'length' || reason === 'tool_calls') return reason
  return 'unknown'
}

export function nvidiaCompletionsUrl(): string {
  return NVIDIA_CHAT_COMPLETIONS_URL
}

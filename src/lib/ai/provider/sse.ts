/**
 * Parse OpenAI-compatible SSE chat.completion.chunk frames.
 */

import { AiProviderError } from '@/lib/ai/provider/errors'
import type { AiToolCall, AiUsage } from '@/lib/ai/types/provider'

export interface SseChunk {
  contentDelta: string
  reasoningDelta: string
  toolCallDeltas: Array<{ index: number; id?: string; name?: string; arguments?: string }>
  finishReason: string | null
  usage: AiUsage | null
  done: boolean
}

export function parseSseBlock(block: string): SseChunk | null {
  const lines = block.split('\n')
  let data = ''
  for (const line of lines) {
    if (line.startsWith('data:')) {
      data += line.slice(5).trim()
    }
  }
  if (!data) return null
  if (data === '[DONE]') {
    return {
      contentDelta: '',
      reasoningDelta: '',
      toolCallDeltas: [],
      finishReason: null,
      usage: null,
      done: true,
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA streamed a non-JSON SSE frame.')
  }
  return parseCompletionChunk(parsed)
}

export function parseCompletionChunk(parsed: unknown): SseChunk {
  if (!parsed || typeof parsed !== 'object') {
    throw new AiProviderError('INVALID_RESPONSE', 'NVIDIA streamed an invalid completion chunk.')
  }
  const record = parsed as {
    choices?: Array<{
      delta?: {
        content?: unknown
        reasoning_content?: unknown
        reasoning?: unknown
        tool_calls?: Array<{
          index?: number
          id?: unknown
          function?: { name?: unknown; arguments?: unknown }
        }>
      }
      finish_reason?: unknown
    }>
    usage?: unknown
  }
  const choice = record.choices?.[0]
  const delta = choice?.delta
  const toolCallDeltas: SseChunk['toolCallDeltas'] = []
  for (const call of delta?.tool_calls ?? []) {
    toolCallDeltas.push({
      index: typeof call.index === 'number' ? call.index : 0,
      id: typeof call.id === 'string' ? call.id : undefined,
      name: typeof call.function?.name === 'string' ? call.function.name : undefined,
      arguments: typeof call.function?.arguments === 'string' ? call.function.arguments : undefined,
    })
  }
  return {
    contentDelta: typeof delta?.content === 'string' ? delta.content : '',
    reasoningDelta:
      typeof delta?.reasoning_content === 'string'
        ? delta.reasoning_content
        : typeof delta?.reasoning === 'string'
          ? delta.reasoning
          : '',
    toolCallDeltas,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    usage: parseUsage(record.usage),
    done: false,
  }
}

export function parseUsage(raw: unknown): AiUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const usage = raw as {
    prompt_tokens?: unknown
    completion_tokens?: unknown
    total_tokens?: unknown
    completion_tokens_details?: { reasoning_tokens?: unknown }
    reasoning_tokens?: unknown
  }
  const input = asNonNegativeInt(usage.prompt_tokens)
  const output = asNonNegativeInt(usage.completion_tokens)
  const reasoning =
    asNonNegativeInt(usage.completion_tokens_details?.reasoning_tokens) ??
    asNonNegativeInt(usage.reasoning_tokens) ??
    0
  if (input === null && output === null) return null
  const inputTokens = input ?? 0
  const outputTokens = output ?? 0
  const total = asNonNegativeInt(usage.total_tokens) ?? inputTokens + outputTokens
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoning,
    total_tokens: total,
  }
}

export function mergeToolCallDeltas(
  existing: AiToolCall[],
  deltas: SseChunk['toolCallDeltas'],
): AiToolCall[] {
  const next = [...existing]
  for (const delta of deltas) {
    const current = next[delta.index] ?? { id: '', name: '', arguments: '' }
    next[delta.index] = {
      id: delta.id ?? current.id,
      name: delta.name ?? current.name,
      arguments: `${current.arguments}${delta.arguments ?? ''}`,
    }
  }
  return next
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

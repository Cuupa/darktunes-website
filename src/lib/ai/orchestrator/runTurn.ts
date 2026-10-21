import { getAiSettings } from '@/lib/api/aiSettings'
import { insertAiUsageEvent } from '@/lib/api/aiUsage'
import {
  getAiConversationForUser,
  insertAiMessage,
  listAiMessages,
} from '@/lib/api/aiConversations'
import { TokenBudgetManager } from '@/lib/ai/budget/manager'
import { estimateInputTokens, estimateTokens, preferProviderUsage, sumAiUsage, usageFromEstimate } from '@/lib/ai/budget/estimator'
import { resolveNvidiaApiKey } from '@/lib/ai/provider/resolveKey'
import { NvidiaOpenAiCompatibleProvider } from '@/lib/ai/provider/nvidia'
import { MockAiProvider } from '@/lib/ai/provider/mock'
import { AiProviderError, isAiProviderError } from '@/lib/ai/provider/errors'
import { apiErrorFromProvider } from '@/lib/ai/provider/mapToApiError'
import { buildSystemPrompt, type PromptPageContext } from '@/lib/ai/prompts/system'
import { slideConversationWindow } from '@/lib/ai/context/window'
import { executeRegisteredTool, listToolDefinitionsForActor } from '@/lib/ai/tools'
import { abortAiTurn, beginAiTurn, conversationTurnKey, endAiTurn } from '@/lib/ai/orchestrator/abortRegistry'
import type { ClientSseEvent } from '@/lib/ai/orchestrator/sse'
import type { AiActor } from '@/lib/ai/auth/requireAiActor'
import type { AiProvider } from '@/lib/ai/provider/interface'
import type { AiChatMessage, AiCompletion } from '@/lib/ai/types/provider'
import { EMPTY_AI_USAGE } from '@/lib/ai/types/provider'
import { shouldEnableThinking } from '@/lib/ai/models/profiles'
import { buildApiError } from '@/lib/errors'

export interface RunTurnInput {
  actor: AiActor
  conversationId: string
  userText: string
  page?: PromptPageContext | null
  locale: 'en' | 'de' | 'fr'
  requestId: string
  providerOverride?: AiProvider
}

export async function* runAiTurn(input: RunTurnInput): AsyncGenerator<ClientSseEvent> {
  const { actor } = input
  const settings = await getAiSettings(actor.serviceDb)
  const enabled = settings.enabled || process.env.AI_ENABLED === 'true'
  const allowMock = Boolean(input.providerOverride) || (settings.testMode && process.env.NODE_ENV !== 'production')
  if (!enabled && !allowMock) {
    throw buildApiError('AI_DISABLED', 503)
  }

  const conversation = await getAiConversationForUser(
    actor.serviceDb,
    input.conversationId,
    actor.userId,
  )
  if (conversation.artistId && actor.artistId && conversation.artistId !== actor.artistId) {
    throw buildApiError('AI_CONVERSATION_NOT_FOUND', 404)
  }

  yield { type: 'status', state: 'connecting' }

  const apiKey = await resolveNvidiaApiKey(actor.serviceDb)
  const provider: AiProvider | null =
    input.providerOverride ??
    (apiKey ? new NvidiaOpenAiCompatibleProvider({ apiKey }) : allowMock ? new MockAiProvider() : null)
  if (!provider) throw buildApiError('AI_NOT_CONFIGURED', 503)

  const history = await listAiMessages(actor.serviceDb, conversation.id, 80)
  const system = buildSystemPrompt({
    accessContext: actor.accessContext,
    page: input.page,
    locale: input.locale,
  })
  const windowed = slideConversationWindow(
    [
      { role: 'system', content: system },
      ...history.map((message) => ({
        role: message.role === 'tool' ? 'tool' as const : message.role,
        content: message.content,
      })),
      { role: 'user', content: input.userText },
    ],
    settings.tokenLimits.max_conversation_context_tokens,
  )

  const tools = listToolDefinitionsForActor(actor)
  const estimate = estimateInputTokens(windowed, tools)
  const modelRole =
    /error|diagnos|root cause|correlate|report/i.test(input.userText) && actor.accessContext !== 'artist'
      ? 'reasoning'
      : 'fast'
  const model = modelRole === 'reasoning' ? settings.modelReasoning : settings.modelFast
  const outputCap =
    modelRole === 'reasoning'
      ? settings.tokenLimits.reasoning.max_output_tokens
      : settings.tokenLimits.fast.max_output_tokens

  const budget = TokenBudgetManager.fromLimits(actor.serviceDb, settings.tokenLimits)
  // Reserve every model round individually so token caps remain atomic when tools loop.
  let activeReservation: string | null = `${input.requestId}:0`
  await budget.reserve({
    requestId: activeReservation,
    userId: actor.userId,
    role: actor.role,
    modelRole,
    estimatedInputTokens: estimate.total_input,
    estimatedOutputTokens: outputCap,
  })

  const controller = beginAiTurn(conversationTurnKey(conversation.id))
  let usage = usageFromEstimate(0, 0)
  let estimatedUsage = false
  let content = ''
  let modelUsed = model

  try {
    await insertAiMessage(actor.serviceDb, {
      conversationId: conversation.id,
      role: 'user',
      content: input.userText,
    })
    yield { type: 'status', state: 'streaming' }
    const messages: AiChatMessage[] = windowed
    let rounds = 0
    const maxRounds =
      modelRole === 'reasoning'
        ? settings.tokenLimits.max_tool_rounds.reasoning
        : settings.tokenLimits.max_tool_rounds.fast

    while (rounds <= maxRounds) {
      if (rounds > 0) {
        activeReservation = `${input.requestId}:${rounds}`
        const roundEstimate = estimateInputTokens(messages, tools)
        await budget.reserve({
          requestId: activeReservation,
          userId: actor.userId,
          role: actor.role,
          modelRole,
          estimatedInputTokens: roundEstimate.total_input,
          estimatedOutputTokens: outputCap,
        })
      }
      let completion: AiCompletion | null = null
      for await (const event of provider.stream(
        {
          request_id: `${input.requestId}:${rounds}`,
          model,
          messages,
          tools,
          max_tokens: outputCap,
          enable_thinking: shouldEnableThinking(modelRole, modelRole === 'reasoning' ? 'complex' : 'simple'),
          low_effort: modelRole === 'reasoning',
        },
        controller.signal,
      )) {
        if (event.type === 'delta') {
          content += event.text
          yield { type: 'delta', text: event.text }
        }
        if (event.type === 'done') completion = event.completion
      }
      if (!completion) {
        completion = {
          request_id: `${input.requestId}:${rounds}`,
          model,
          content,
          reasoning_content: null,
          tool_calls: [],
          finish_reason: 'unknown',
          usage: EMPTY_AI_USAGE,
          latency_ms: 0,
        }
      }
      modelUsed = completion.model
      // Provider usage is per completion, not cumulative across tool rounds.
      const hasProviderUsage = completion.usage.total_tokens > 0
      const roundUsage = preferProviderUsage(
        usageFromEstimate(
          estimateInputTokens(messages, tools).total_input,
          estimateTokens(completion.content) +
            estimateTokens(completion.reasoning_content ?? '') +
            estimateTokens(JSON.stringify(completion.tool_calls)),
        ),
        hasProviderUsage ? completion.usage : null,
      )
      estimatedUsage ||= !hasProviderUsage
      usage = sumAiUsage(usage, roundUsage)
      if (activeReservation) {
        await budget.settle(activeReservation, roundUsage.total_tokens)
        activeReservation = null
      }
      yield {
        type: 'usage',
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        reasoning_tokens: usage.reasoning_tokens,
        total_tokens: usage.total_tokens,
      }

      if (completion.tool_calls.length === 0) {
        content = completion.content || content
        break
      }

      if (rounds >= maxRounds) {
        throw new AiProviderError('INVALID_RESPONSE', 'The assistant reached the maximum number of tool rounds.')
      }
      messages.push({
        role: 'assistant',
        content: completion.content,
        tool_calls: completion.tool_calls,
      })
      for (const call of completion.tool_calls) {
        yield { type: 'status', state: 'tool_running' }
        yield { type: 'tool_start', tool_name: call.name }
        let args: unknown = {}
        try {
          args = call.arguments ? JSON.parse(call.arguments) : {}
        } catch {
          args = {}
        }
        const executed = await executeRegisteredTool(call.name, args, {
          actor,
          requestId: input.requestId,
        })
        yield { type: 'tool_result', tool_name: call.name, ok: executed.ok }
        if (executed.ok && isConfirmationResult(executed.result)) {
          yield {
            type: 'confirmation_required',
            action: executed.result.action,
            confirmation_token: executed.result.confirmation_token,
            summary: executed.result.summary,
          }
        }
        messages.push({
          role: 'tool',
          name: call.name,
          tool_call_id: call.id,
          content: JSON.stringify(
            executed.ok ? omitConfirmationToken(executed.result) : { error: executed.error },
          ),
        })
      }
      yield { type: 'status', state: 'streaming' }
      rounds += 1
    }

    await insertAiMessage(actor.serviceDb, {
      conversationId: conversation.id,
      role: 'assistant',
      content,
      model: modelUsed,
      tokenUsage: { ...usage },
      status: 'complete',
    })
    await insertAiUsageEvent(actor.serviceDb, {
      userId: actor.userId,
      artistId: actor.artistId,
      conversationId: conversation.id,
      requestId: input.requestId,
      model: modelUsed,
      usage,
      usageSource: estimatedUsage ? 'estimate' : 'provider',
      operationType: 'chat',
    })
    yield { type: 'done', model: modelUsed }
  } catch (error) {
    // On failures, charge the outstanding reservation instead of losing usage.
    if (activeReservation) await budget.settle(activeReservation, null)
    if (controller.signal.aborted) {
      yield { type: 'error', code: 'AI_PROVIDER_TIMEOUT', detail: 'The answer was cancelled.' }
      return
    }
    if (isAiProviderError(error)) {
      const apiError = apiErrorFromProvider(error)
      yield { type: 'error', code: apiError.code ?? 'AI_PROVIDER_UNAVAILABLE', detail: apiError.message }
      return
    }
    throw error
  } finally {
    endAiTurn(conversationTurnKey(conversation.id))
  }
}

function isConfirmationResult(
  value: unknown,
): value is { action: string; confirmation_token: string; summary: string } {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.confirmation_token === 'string' &&
    typeof record.action === 'string' &&
    typeof record.summary === 'string'
  )
}

function omitConfirmationToken(value: unknown): unknown {
  if (!isConfirmationResult(value)) return value
  const rest = { ...(value as Record<string, unknown>) }
  delete rest.confirmation_token
  return rest
}

export { abortAiTurn, conversationTurnKey }

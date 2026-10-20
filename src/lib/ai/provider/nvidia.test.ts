import { describe, expect, it, vi } from 'vitest'
import { AiProviderError } from '@/lib/ai/provider/errors'
import { NvidiaOpenAiCompatibleProvider, buildNvidiaPayload } from '@/lib/ai/provider/nvidia'
import { getModelProfile } from '@/lib/ai/models/profiles'
import type { AiCompletionRequest } from '@/lib/ai/types/provider'

const baseRequest: AiCompletionRequest = {
  request_id: 'req-1',
  model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  messages: [{ role: 'user', content: 'ping' }],
  max_tokens: 32,
  enable_thinking: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('NvidiaOpenAiCompatibleProvider', () => {
  it('should omit reasoning_budget until the capability is discovered', () => {
    const payload = buildNvidiaPayload(baseRequest, false, getModelProfile(baseRequest.model))
    expect(payload.reasoning_budget).toBeUndefined()
    expect(payload.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it('should send reasoning_budget only on the discovered path', () => {
    const capabilities = {
      ...getModelProfile(baseRequest.model),
      supports_reasoning_budget: true,
      reasoning_budget_path: 'top_level' as const,
    }
    const payload = buildNvidiaPayload(
      { ...baseRequest, reasoning_budget: 256, enable_thinking: true },
      false,
      capabilities,
    )
    expect(payload.reasoning_budget).toBe(256)
  })

  it('should complete a non-streaming NVIDIA response', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      }),
    )
    const provider = new NvidiaOpenAiCompatibleProvider({ apiKey: 'nvapi-test', fetchImpl })
    const completion = await provider.complete(baseRequest)
    expect(completion.content).toBe('pong')
    expect(completion.usage.total_tokens).toBe(5)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('should map HTTP 401 to INVALID_KEY', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: 'bad key' } }, 401))
    const provider = new NvidiaOpenAiCompatibleProvider({ apiKey: 'bad', fetchImpl })
    await expect(provider.complete(baseRequest)).rejects.toMatchObject({
      code: 'INVALID_KEY',
    } satisfies Partial<AiProviderError>)
  })

  it('should stream content deltas then emit done', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"po"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"ng"}}]}\n\n',
      'data: {"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":4}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fetchImpl = vi.fn(
      async () =>
        new Response(sse, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    )
    const provider = new NvidiaOpenAiCompatibleProvider({ apiKey: 'nvapi-test', fetchImpl })
    const events = []
    for await (const event of provider.stream(baseRequest)) {
      events.push(event)
    }
    expect(events.filter((event) => event.type === 'delta').map((event) => event.type === 'delta' && event.text)).toEqual([
      'po',
      'ng',
    ])
    const done = events.at(-1)
    expect(done?.type).toBe('done')
    if (done?.type === 'done') {
      expect(done.completion.content).toBe('pong')
      expect(done.completion.usage.total_tokens).toBe(4)
    }
  })

  it('should abort an in-flight request', async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    const provider = new NvidiaOpenAiCompatibleProvider({ apiKey: 'nvapi-test', fetchImpl: fetchImpl as typeof fetch })
    const pending = provider.complete(baseRequest)
    provider.abort('req-1')
    await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' })
  })
})

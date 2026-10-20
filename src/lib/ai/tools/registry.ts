import { z } from 'zod'
import { ApiError } from '@/lib/errors'
import type { AiActor } from '@/lib/ai/auth/requireAiActor'
import type { AiToolDefinition } from '@/lib/ai/types/provider'
import type { RegisteredTool, ToolContext } from '@/lib/ai/tools/types'
import { resolveEffectiveAccess } from '@/lib/rbac/resolveAccess'

const echoInput = z.object({ ping: z.string() })
const echoOutput = z.object({ pong: z.string() })

const echoTool: RegisteredTool<typeof echoInput, typeof echoOutput> = {
  name: 'echo_test',
  description: 'Return the provided ping string. Harmless diagnostic tool.',
  input: echoInput,
  output: echoOutput,
  capabilities: [],
  dataScope: 'none',
  classification: 'read',
  maxResultBytes: 1024,
  timeoutMs: 2_000,
  execute: async (input) => ({ pong: input.ping }),
}

const tools = new Map<string, RegisteredTool<z.ZodType, z.ZodType>>([
  [echoTool.name, echoTool as RegisteredTool<z.ZodType, z.ZodType>],
])

export function registerTool<TIn extends z.ZodType, TOut extends z.ZodType>(
  tool: RegisteredTool<TIn, TOut>,
): void {
  tools.set(tool.name, tool as RegisteredTool<z.ZodType, z.ZodType>)
}

export function listToolDefinitionsForActor(actor: AiActor): AiToolDefinition[] {
  return [...tools.values()]
    .filter((tool) => toolVisibleTo(tool, actor))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.input),
    }))
}

export function getRegisteredTool(name: string): RegisteredTool<z.ZodType, z.ZodType> | undefined {
  return tools.get(name)
}

export async function executeRegisteredTool(
  name: string,
  rawArgs: unknown,
  context: ToolContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = tools.get(name)
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` }
  if (!toolVisibleTo(tool, context.actor)) {
    throw new ApiError(403, 'That assistant action is not allowed for this account.', 'AI_TOOL_FORBIDDEN')
  }
  if (tool.capabilities.length > 0) {
    const access = await resolveEffectiveAccess(context.actor.serviceDb, context.actor.userId)
    const missing = tool.capabilities.filter((cap) => !access.capabilities.has(cap))
    if (missing.length > 0) {
      throw new ApiError(403, 'That assistant action is not allowed for this account.', 'AI_TOOL_FORBIDDEN')
    }
  }
  const parsed = tool.input.safeParse(rawArgs)
  if (!parsed.success) return { ok: false, error: 'Invalid tool arguments.' }
  const result = await withTimeout(tool.execute(parsed.data, context), tool.timeoutMs)
  const encoded = JSON.stringify(result)
  if (encoded.length > tool.maxResultBytes) {
    return { ok: false, error: 'Tool result exceeded the size limit.' }
  }
  const out = tool.output.safeParse(result)
  if (!out.success) return { ok: false, error: 'Tool result failed validation.' }
  return { ok: true, result: out.data }
}

function toolVisibleTo(tool: RegisteredTool<z.ZodType, z.ZodType>, actor: AiActor): boolean {
  if (tool.dataScope === 'label' && actor.accessContext === 'artist') return false
  return true
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tool timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}


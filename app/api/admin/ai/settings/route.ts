/**
 * GET   /api/admin/ai/settings
 * PATCH /api/admin/ai/settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { getAiSettings, updateAiSettings } from '@/lib/api/aiSettings'

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  test_mode: z.boolean().optional(),
  default_streaming: z.boolean().optional(),
  model_fast: z.string().min(1).optional(),
  model_reasoning: z.string().min(1).optional(),
  max_tool_rounds: z.number().int().min(1).max(12).optional(),
  token_limits: z.record(z.string(), z.unknown()).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)
  const settings = await getAiSettings(serviceClient)
  return NextResponse.json({
    enabled: settings.enabled,
    test_mode: settings.testMode,
    provider: settings.provider,
    model_fast: settings.modelFast,
    model_reasoning: settings.modelReasoning,
    default_streaming: settings.defaultStreaming,
    token_limits: settings.tokenLimits,
    max_tool_rounds: settings.maxToolRounds,
    last_connection_test: settings.lastConnectionTest,
  })
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { userId, serviceClient } = await requireAdminWithServiceClient(req)
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) throw new ApiError(400, 'Invalid AI settings payload', 'VALIDATION_ERROR')
  const settings = await updateAiSettings(serviceClient, {
    enabled: parsed.data.enabled,
    test_mode: parsed.data.test_mode,
    default_streaming: parsed.data.default_streaming,
    model_fast: parsed.data.model_fast,
    model_reasoning: parsed.data.model_reasoning,
    max_tool_rounds: parsed.data.max_tool_rounds,
    token_limits: parsed.data.token_limits,
    updated_by: userId,
  })
  return NextResponse.json({
    enabled: settings.enabled,
    test_mode: settings.testMode,
    provider: settings.provider,
    model_fast: settings.modelFast,
    model_reasoning: settings.modelReasoning,
    default_streaming: settings.defaultStreaming,
    token_limits: settings.tokenLimits,
    max_tool_rounds: settings.maxToolRounds,
    last_connection_test: settings.lastConnectionTest,
  })
})

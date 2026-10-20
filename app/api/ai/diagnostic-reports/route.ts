/**
 * POST /api/ai/diagnostic-reports — persist a developer error report (admin).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { buildDeveloperErrorReport } from '@/lib/ai/diagnostics/buildReport'

const bodySchema = z.object({
  error_id: z.string().min(3).max(80),
  fingerprint: z.string().min(3).max(200).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const actor = await requireAiActor(req)
  if (actor.accessContext === 'artist') {
    throw new ApiError(403, 'Developer reports are limited to label staff.', 'FORBIDDEN')
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) throw new ApiError(400, 'error_id is required', 'VALIDATION_ERROR')

  let query = actor.serviceDb.from('app_logs').select('*').limit(1)
  if (parsed.data.fingerprint) query = query.eq('fingerprint', parsed.data.fingerprint)
  else query = query.ilike('message', `%${parsed.data.error_id}%`)
  const { data, error } = await query.maybeSingle()
  if (error) throw new ApiError(500, 'The error log could not be read.', 'DB_ERROR')
  if (!data) throw new ApiError(404, 'No matching error was found.', 'NOT_FOUND')

  const report = buildDeveloperErrorReport({ errorId: parsed.data.error_id, log: data })
  await actor.serviceDb.from('ai_diagnostics').insert({
    user_id: actor.userId,
    error_reference: parsed.data.error_id,
    fingerprint: data.fingerprint,
    analysis_status: 'complete',
    classification: report.diagnosis_confidence,
    sanitized_analysis: report,
    model: null,
  })
  return NextResponse.json({ report }, { status: 201 })
})

/**
 * app/api/log-error/route.ts — Log application errors to the app_logs table.
 *
 * POST /api/log-error
 * Auth: any authenticated user (public-facing errors can be logged by users too)
 *
 * Body: { source, level?, message, details? }
 *   source  — 'r2' | 'supabase' | 'upload' | 'ui' | 'vercel' | string
 *   level   — 'error' | 'warn' | 'info' (defaults to 'error')
 *   message — human-readable error message
 *   details — optional JSON object with extra context
 *
 * Returns: { id }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { withErrorHandler, ApiError } from '@/lib/errors'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const supabase = createServerSupabaseClient()

  // Require an authenticated user (prevents abuse from anonymous callers)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new ApiError(401, 'Unauthorized')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (typeof body !== 'object' || body === null) {
    throw new ApiError(400, 'Body must be a JSON object')
  }

  const { source, message, level, details } = body as Record<string, unknown>

  if (typeof source !== 'string' || !source) {
    throw new ApiError(400, 'Field "source" is required and must be a string')
  }
  if (typeof message !== 'string' || !message) {
    throw new ApiError(400, 'Field "message" is required and must be a string')
  }
  const resolvedLevel = typeof level === 'string' && ['error', 'warn', 'info'].includes(level)
    ? (level as 'error' | 'warn' | 'info')
    : 'error'

  const resolvedDetails =
    typeof details === 'object' && details !== null && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {}

  const { data, error } = await supabase
    .from('app_logs')
    .insert({
      source,
      level: resolvedLevel,
      message,
      details: resolvedDetails,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (error) {
    throw new ApiError(500, `Failed to write log: ${error.message}`)
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
})

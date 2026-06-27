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
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolveUserProfile } from '@/lib/api/zammadSupport'
import { writeAppLog } from '@/lib/appLog'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { submitAutoErrorTicket } from '@/lib/zammad/submitTicket'

/** Client UI crash reports only — excludes operational admin monitoring sources. */
const AUTO_ZAMMAD_SOURCES = new Set(['ui'])

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()

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

  await writeAppLog({
    source,
    level: resolvedLevel,
    message,
    details: resolvedDetails,
    userId: user.id,
  })

  if (resolvedLevel === 'error' && AUTO_ZAMMAD_SOURCES.has(source)) {
    const viewPath =
      typeof resolvedDetails.path === 'string' ? resolvedDetails.path : null

    void (async () => {
      try {
        const db = await createServiceRoleSupabaseClient()
        const profile = await resolveUserProfile(
          db,
          user.id,
          user.email,
          (user.user_metadata?.full_name as string | undefined) ?? null,
        )

        submitAutoErrorTicket({
          userId: user.id,
          customerEmail: profile.email,
          customerName: profile.name,
          source,
          message,
          viewPath,
          details: resolvedDetails,
        })
      } catch {
        // Background ticket creation must never affect the error response
      }
    })()
  }

  return NextResponse.json({ ok: true }, { status: 201 })
})

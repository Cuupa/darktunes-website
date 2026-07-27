/**
 * app/api/log-error/route.ts — Log application errors to the app_logs table.
 *
 * POST /api/log-error
 * Auth: any authenticated user (public-facing errors can be logged by users too)
 *
 * Body: { source, level?, message, details? }
 *   source  — short origin tag (e.g. ui, sos.bronze.upload, admin.health)
 *   level   — 'error' | 'warn' | 'info' (defaults to 'error')
 *   message — human-readable error message
 *   details — optional JSON object with extra context
 *
 * Returns: { ok: true }
 *
 * Zammad auto-tickets: only for exact source `ui` (client crash reports).
 * Never rewrite unknown sources to `ui` — that would open support tickets for
 * operational SOS/admin logs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolveUserProfile } from '@/lib/api/zammadSupport'
import { writeAppLog } from '@/lib/appLog'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { submitAutoErrorTicket } from '@/lib/zammad/submitTicket'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { PORTAL_LOG_ERROR_RATE } from '@/lib/uploads/portalUploadLimits'

/** Client UI crash reports only — excludes operational admin/SOS monitoring sources. */
const AUTO_ZAMMAD_SOURCES = new Set(['ui'])

const bodySchema = z.object({
  source: z.string().min(1).max(64),
  message: z.string().min(1).max(4000),
  level: z.enum(['error', 'warn', 'info']).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})

/** Keep tags readable; strip control / injection characters. Never rewrite to `ui`. */
function sanitizeSource(raw: string): string {
  const cleaned = raw
    .trim()
    .slice(0, 64)
    .replace(/[^\w.\-:/]/g, '_')
  return cleaned || 'unknown'
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()

  // Require an authenticated user (prevents abuse from anonymous callers)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new ApiError(401, 'Unauthorized')
  }

  const ip = getClientIp(request)
  const rl = await checkDistributedRateLimit(
    `log-error:${user.id}:${ip}`,
    PORTAL_LOG_ERROR_RATE.max,
    PORTAL_LOG_ERROR_RATE.windowMs,
  )
  if (rl.limited) {
    throw new ApiError(429, 'Too many error reports. Please wait and try again.')
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new ApiError(400, 'Invalid log payload', 'VALIDATION_ERROR')
  }

  const { source: rawSource, message, level, details } = parsed.data
  const source = sanitizeSource(rawSource)
  const resolvedLevel = level ?? 'error'
  const resolvedDetails = details ?? {}

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

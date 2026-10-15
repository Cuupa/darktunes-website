/**
 * app/api/log-error/route.ts — Log application errors to the app_logs table.
 *
 * POST /api/log-error
 * Auth: optional (session attached when present). Public so crashes on
 * login/public pages still persist. Always 204 — never retry-loop.
 *
 * Body: { source, level?, message, details? }
 *   source  — short origin tag (e.g. ui, sos.bronze.upload, admin.health)
 *   level   — 'error' | 'warn' | 'info' (defaults to 'error')
 *   message — human-readable error message
 *   details — optional JSON object with extra context
 *
 * Zammad auto-tickets: only for exact source `ui` when a user is signed in.
 * Never rewrite unknown sources to `ui`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolveUserProfile } from '@/lib/api/zammadSupport'
import { writeAppLog } from '@/lib/appLog'
import { withErrorHandler } from '@/lib/errors'
import { submitAutoErrorTicket } from '@/lib/zammad/submitTicket'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { PORTAL_LOG_ERROR_RATE } from '@/lib/uploads/portalUploadLimits'

const AUTO_ZAMMAD_SOURCES = new Set(['ui'])
const maxBodyLength = 20_000

const bodySchema = z.object({
  source: z.string().min(1).max(64),
  message: z.string().min(1).max(4000),
  level: z.enum(['error', 'warn', 'info']).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
})

function sanitizeSource(raw: string): string {
  const cleaned = raw
    .trim()
    .slice(0, 64)
    .replace(/[^\w.\-:/]/g, '_')
  return cleaned || 'unknown'
}

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ip = getClientIp(request)
  const rlKey = user ? `log-error:${user.id}:${ip}` : `log-error:anon:${ip}`
  const rl = await checkDistributedRateLimit(
    rlKey,
    PORTAL_LOG_ERROR_RATE.max,
    PORTAL_LOG_ERROR_RATE.windowMs,
  )
  if (rl.limited) {
    return noContent()
  }

  let rawText: string
  try {
    rawText = await request.text()
  } catch {
    return noContent()
  }
  if (!rawText || rawText.length > maxBodyLength) {
    return noContent()
  }

  let raw: unknown
  try {
    raw = JSON.parse(rawText)
  } catch {
    return noContent()
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return noContent()
  }

  const { source: rawSource, message, level, details } = parsed.data
  const source = sanitizeSource(rawSource)
  const resolvedLevel = level ?? 'error'
  const resolvedDetails = details ?? {}
  const viewPath =
    typeof resolvedDetails.path === 'string' ? resolvedDetails.path : null

  const persisted = await writeAppLog({
    source,
    level: resolvedLevel,
    message,
    details: resolvedDetails,
    userId: user?.id ?? null,
    routePath: viewPath,
  })

  if (!persisted) {
    // The log store rejected the write (missing columns/RPC, DB error). Report it
    // so the reporting client can surface the gap instead of believing it logged.
    return new NextResponse(null, { status: 503 })
  }

  if (user && resolvedLevel === 'error' && AUTO_ZAMMAD_SOURCES.has(source)) {
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

  return noContent()
})

/**
 * src/lib/errors.ts
 *
 * Centralized error handling for Next.js Route Handlers.
 *
 * Usage:
 *   export const GET = withErrorHandler(async (req) => {
 *     // ... handler logic
 *     return NextResponse.json({ data })
 *   })
 *
 * Any unhandled error is caught, logged, and returned as a standardised
 * JSON error response with the correct HTTP status code.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'

// ---------------------------------------------------------------------------
// ApiError — structured error thrown inside route handlers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ---------------------------------------------------------------------------
// Standard JSON error shape
// ---------------------------------------------------------------------------

export interface ApiErrorResponse {
  error: string
  code?: string
  status: number
}

function buildErrorResponse(
  message: string,
  status: number,
  code?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error: message, code, status }, { status })
}

// ---------------------------------------------------------------------------
// DB error logger — writes to app_logs for visibility in the Admin Logs tab
// ---------------------------------------------------------------------------

async function persistErrorToDb(
  source: string,
  message: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) return

    // Use a fire-and-forget fetch so we never block the error response
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    await db.from('app_logs').insert({
      source,
      level: 'error',
      message,
      details,
    })
  } catch {
    // Never throw from the error logger — silently ignore any DB failures
  }
}

// ---------------------------------------------------------------------------
// withErrorHandler — Higher-Order Function for Route Handlers
// ---------------------------------------------------------------------------

type RouteHandler = (req: NextRequest) => Promise<NextResponse>

/**
 * Wraps a Next.js Route Handler with centralised error handling.
 *
 * Handles:
 *   - `ApiError`   → returns the error's status code and message as JSON
 *   - `ZodError`   → returns 400 with a human-readable validation message
 *   - Unknown errors → returns 500 Internal Server Error (sanitised message)
 *                      and persists the error to the `app_logs` DB table
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req) => {
    try {
      return await handler(req)
    } catch (err) {
      if (err instanceof ApiError) {
        return buildErrorResponse(err.message, err.status, err.code)
      }

      if (err instanceof ZodError) {
        const message = err.issues.map((e) => e.message).join('; ')
        return buildErrorResponse(message, 400, 'VALIDATION_ERROR')
      }

      // Unknown error — log server-side and persist to app_logs
      console.error('[withErrorHandler] Unhandled route error:', err)
      const errMessage = err instanceof Error ? err.message : String(err)
      const routePath = (() => {
        try { return new URL(req.url).pathname } catch { return req.url }
      })()
      void persistErrorToDb('api', errMessage, {
        path: routePath,
        method: req.method,
        stack: err instanceof Error ? (err.stack ?? null) : null,
      })
      const message =
        process.env.NODE_ENV === 'development' && err instanceof Error
          ? err.message
          : 'An unexpected server error occurred. Please try again later.'
      return buildErrorResponse(message, 500, 'INTERNAL_SERVER_ERROR')
    }
  }
}

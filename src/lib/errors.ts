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
// withErrorHandler — Higher-Order Function for Route Handlers
// ---------------------------------------------------------------------------

type RouteHandler = (
  req: NextRequest,
  context?: { params: Record<string, string> },
) => Promise<NextResponse>

/**
 * Wraps a Next.js Route Handler with centralised error handling.
 *
 * Handles:
 *   - `ApiError`   → returns the error's status code and message as JSON
 *   - `ZodError`   → returns 400 with a human-readable validation message
 *   - Unknown errors → returns 500 Internal Server Error (sanitised message)
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context)
    } catch (err) {
      if (err instanceof ApiError) {
        return buildErrorResponse(err.message, err.status, err.code)
      }

      if (err instanceof ZodError) {
        const message = err.errors.map((e) => e.message).join('; ')
        return buildErrorResponse(message, 400, 'VALIDATION_ERROR')
      }

      // Unknown error — log server-side, return sanitised message
      console.error('[withErrorHandler] Unhandled route error:', err)
      const message =
        process.env.NODE_ENV === 'development' && err instanceof Error
          ? err.message
          : 'An unexpected server error occurred. Please try again later.'
      return buildErrorResponse(message, 500, 'INTERNAL_SERVER_ERROR')
    }
  }
}

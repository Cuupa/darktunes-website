/**
 * app/api/webhooks/sos/confirm/route.ts — SOS Upload Confirmation
 *
 * Step 2 of the 2-step presigned URL upload flow for Statement-of-Sales PDFs.
 *
 * Called by the external SOS generator AFTER it has successfully uploaded the
 * PDF directly to R2 via the presigned PUT URL from Step 1 (/api/webhooks/sos).
 *
 * This endpoint:
 *   1. Authenticates the caller via the same shared secret API key
 *   2. Validates the payload (r2Key, artistId, filename, period, amountEur?)
 *   3. Verifies the artist exists
 *   4. Inserts a new `sales_statements` row pointing at the R2 object
 *   5. Returns the new statement ID
 *
 * Authentication:
 *   Authorization: Bearer <SOS_WEBHOOK_SECRET>
 *
 * If the r2_key already exists in the DB (duplicate upload), a 409 Conflict is
 * returned — the caller should treat this as a no-op and log the duplicate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError, buildApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getArtistById } from '@/lib/api/artists'
import { createSalesStatement } from '@/lib/api/salesStatements'
import { checkAndClaimIdempotencyKey, updateIdempotencyKeyResourceId } from '@/lib/api/idempotency'

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  /** The R2 object key returned by POST /api/webhooks/sos */
  r2Key: z.string().min(1).max(512),
  /** UUID of the artist this statement belongs to */
  artistId: z.string().uuid({ message: 'artistId must be a valid UUID' }),
  /** Human-readable filename stored in the DB */
  filename: z.string().min(1).max(255),
  /** Billing period: "YYYY-MM" or "Q{N}-YYYY" */
  period: z
    .string()
    .min(1)
    .max(20)
    .regex(/^(\d{4}-\d{2}|Q[1-4]-\d{4})$/, {
      message: 'period must be YYYY-MM or Q{N}-YYYY (e.g. "2024-03" or "Q1-2024")',
    }),
  /** Total royalty amount in EUR (optional) */
  amountEur: z.number().nonnegative().optional(),
  /**
   * Optional idempotency key (UUID) to prevent duplicate statement creation
   * on network retries. If omitted, the r2_key unique constraint still
   * provides server-side deduplication.
   */
  idempotencyKey: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — shared secret API key (same as Step 1)
  const sosSecret = process.env.SOS_WEBHOOK_SECRET
  if (!sosSecret) {
    throw buildApiError('CONFIG_ERROR', 503)
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || token !== sosSecret) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED')
  }

  // 2. Parse + validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON', 'INVALID_JSON')
  }

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { r2Key, artistId, filename, period, amountEur, idempotencyKey } = parsed.data

  // 3. Verify artist exists (service-role client bypasses RLS)
  const supabase = await createServiceRoleSupabaseClient()

  // 3a. Idempotency check — if the caller provided a key, claim it atomically.
  //     A duplicate key within 24 h means the operation was already processed.
  if (idempotencyKey) {
    const claimed = await checkAndClaimIdempotencyKey(supabase, idempotencyKey, 'sos-confirm')
    if (!claimed) {
      throw new ApiError(
        409,
        'This request has already been processed (duplicate idempotency key)',
        'DUPLICATE_IDEMPOTENCY_KEY',
      )
    }
  }

  const artist = await getArtistById(supabase, artistId)
  if (!artist) {
    throw new ApiError(404, `Artist ${artistId} not found`, 'ARTIST_NOT_FOUND')
  }

  // 4. Insert sales_statements row — service-role client bypasses RLS
  let statement
  try {
    statement = await createSalesStatement(supabase, {
      artistId,
      filename,
      r2Key,
      period,
      amountEur,
    })
  } catch (err) {
    // Postgres unique constraint on r2_key — treat as duplicate upload
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('duplicate key') || msg.includes('unique constraint') || msg.includes('r2_key')) {
      throw new ApiError(409, 'A statement with this r2Key already exists', 'DUPLICATE_R2_KEY')
    }
    throw err
  }

  // 5. Send email notification (non-blocking — failure must not abort the response)
  try {
    const { serverEnv } = await import('@/lib/env.server')
    const { sendStatementNotification } = await import('@/lib/email/sendStatementNotification')

    await sendStatementNotification(
      artist,
      { filename, period, amountEur },
      {
        resendApiKey: serverEnv.RESEND_API_KEY ?? '',
        resendFromEmail: serverEnv.RESEND_FROM_EMAIL ?? 'noreply@darktunes.com',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com',
        fetch,
      },
    )
  } catch (emailErr) {
    // Email failure is non-critical — log but don't abort response
    console.error('[SOS confirm] Email notification failed:', emailErr)
  }

  // Update idempotency key with the created resource ID (non-blocking)
  if (idempotencyKey) {
    void updateIdempotencyKeyResourceId(supabase, idempotencyKey, statement.id)
  }

  return NextResponse.json({ statementId: statement.id }, { status: 201 })
})

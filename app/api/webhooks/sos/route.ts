/**
 * app/api/webhooks/sos/route.ts — SOS Upload Initiation
 *
 * Step 1 of the 2-step presigned URL upload flow for Statement-of-Sales PDFs.
 *
 * Called by the external SOS generator (https://sos-generator-for-mu.vercel.app/)
 * BEFORE it uploads a PDF. This endpoint:
 *   1. Authenticates the caller via a shared secret API key
 *   2. Validates the statement metadata
 *   3. Verifies the artist exists in the database
 *   4. Generates a time-limited (15 min) presigned R2 PUT URL
 *   5. Returns the upload URL + the R2 object key
 *
 * The caller then:
 *   a) Uploads the PDF directly to R2 using the presigned PUT URL
 *   b) Calls POST /api/webhooks/sos/confirm with the r2Key to persist the DB record
 *
 * WHY presigned URLs?
 *   Vercel Serverless Functions have a strict 4.5 MB request body limit.
 *   PDFs can easily exceed this. The presigned URL pattern routes the binary
 *   directly from the SOS generator → R2, with only lightweight JSON passing
 *   through Vercel.
 *
 * Authentication:
 *   Authorization: Bearer <SOS_WEBHOOK_SECRET>
 *   Set SOS_WEBHOOK_SECRET as a Vercel environment variable.
 *   Generate with: openssl rand -hex 32
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getArtistById } from '@/lib/api/artists'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedUploadUrl } from '@/lib/portal/presignedUrl'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  /** UUID of the artist this statement belongs to */
  artistId: z.string().uuid({ message: 'artistId must be a valid UUID' }),
  /** Human-readable filename (e.g. "Statement_Q1-2024_BandName.pdf") */
  filename: z.string().min(1).max(255),
  /**
   * Billing period in "YYYY-MM" or "Q{N}-YYYY" format.
   * Examples: "2024-03", "Q1-2024"
   */
  period: z
    .string()
    .min(1)
    .max(20)
    .regex(/^(\d{4}-\d{2}|Q[1-4]-\d{4})$/, {
      message: 'period must be YYYY-MM or Q{N}-YYYY (e.g. "2024-03" or "Q1-2024")',
    }),
  /** Total royalty amount in EUR (optional — can be omitted for non-monetary statements) */
  amountEur: z.number().nonnegative().optional(),
})

export type SosUploadRequestBody = z.infer<typeof bodySchema>

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — shared secret API key
  const sosSecret = process.env.SOS_WEBHOOK_SECRET
  if (!sosSecret) {
    throw new ApiError(503, 'SOS webhook is not configured (SOS_WEBHOOK_SECRET missing)', 'NOT_CONFIGURED')
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

  const { artistId, filename, period, amountEur } = parsed.data

  // 3. Verify artist exists (service-role client bypasses RLS)
  const supabase = await createServiceRoleSupabaseClient()
  const artist = await getArtistById(supabase, artistId)
  if (!artist) {
    throw new ApiError(404, `Artist ${artistId} not found`, 'ARTIST_NOT_FOUND')
  }

  // 4. Build R2 key and generate presigned PUT URL
  const { serverEnv } = await import('@/lib/env.server')

  // Sanitize filename for use as part of the R2 key
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const r2Key = `statements/${artistId}/${randomUUID()}_${safeName}`

  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadUrl = await generatePresignedUploadUrl(r2Key, 'application/pdf', {
    getSignedUrl,
    s3Client: s3,
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  })

  // 5. Return the presigned URL and metadata the caller needs for Step 2
  return NextResponse.json(
    {
      uploadUrl,
      r2Key,
      artistId,
      filename,
      period,
      amountEur: amountEur ?? null,
      expiresInSeconds: 900,
    },
    { status: 200 },
  )
})

'use server'

/**
 * app/portal/statements/_actions/uploadStatement.ts — Server Action
 *
 * Handles the complete Statement-of-Sales PDF upload flow entirely within the
 * app, replacing the now-obsolete external webhook approach.
 *
 * Security:
 *   - Authenticated via the caller's Supabase session (admin or editor role required)
 *   - No shared secret or external service involved
 *   - Credentials never leave the server
 */

import { randomUUID } from 'crypto'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { getArtistById } from '@/lib/api/artists'
import { createSalesStatement } from '@/lib/api/salesStatements'
import { getOrCreateSettlementPeriod } from '@/lib/api/settlementPeriods'
import { createSalesStatementLineItems } from '@/lib/api/salesStatementLineItems'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedUploadUrl } from '@/lib/portal/presignedUrl'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface UploadStatementLineItemInput {
  platform?: string
  country?: string
  streams?: number
  revenueEur?: number
  quantity?: number
  releaseId?: string
}

export interface UploadStatementInput {
  artistId: string
  filename: string
  period: string
  amountEur?: number
  periodStart?: string
  periodEnd?: string
  totalStreams?: number
  batchId?: string
  lineItems?: UploadStatementLineItemInput[]
  /** PDF file contents encoded as a Base64 string. */
  pdfBase64: string
  /** When true, sends the artist notification email immediately. Defaults to false. */
  notifyArtist?: boolean
}

export interface UploadStatementResult {
  success: boolean
  statementId?: string
  error?: string
}

/**
 * Server Action: upload a Statement-of-Sales PDF directly to R2 and persist
 * the metadata record in the database.
 *
 * Requires the caller to be authenticated with admin or editor role.
 */
export async function uploadStatement(
  input: UploadStatementInput,
): Promise<UploadStatementResult> {
  try {
    // 1. Authenticate via session cookie (admin/editor only)
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const role = await getUserRoleWithClient(supabase, user.id)
    if (!role || !['admin', 'editor'].includes(role)) {
      return { success: false, error: 'Forbidden: admin or editor role required' }
    }

    // 2. Verify the artist exists
    const serviceSupabase = await createServiceRoleSupabaseClient()
    const artist = await getArtistById(serviceSupabase, input.artistId)
    if (!artist) {
      return { success: false, error: `Artist ${input.artistId} not found` }
    }

    // 3. Build the R2 key and generate a presigned PUT URL
    const { serverEnv } = await import('@/lib/env.server')
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const r2Key = `statements/${input.artistId}/${randomUUID()}_${safeName}`

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

    // 4. Upload the PDF blob directly to R2 via the presigned URL
    const pdfBuffer = Buffer.from(input.pdfBase64, 'base64')
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBuffer,
      headers: { 'Content-Type': 'application/pdf' },
    })

    if (!uploadRes.ok) {
      return { success: false, error: `R2 upload failed (${uploadRes.status})` }
    }

    // 5. Persist the DB record via service-role client (bypasses RLS)
    const periodStart = input.periodStart ?? null
    const periodEnd = input.periodEnd ?? null
    const settlementPeriod =
      periodStart && periodEnd
        ? await getOrCreateSettlementPeriod(serviceSupabase, periodStart, periodEnd)
        : null

    const statement = await createSalesStatement(serviceSupabase, {
      artistId: input.artistId,
      filename: input.filename,
      r2Key,
      period: input.period,
      amountEur: input.amountEur,
      periodStart,
      periodEnd,
      totalStreams: input.totalStreams ?? 0,
      batchId: input.batchId ?? null,
    })

    if (settlementPeriod) {
      await serviceSupabase
        .from('sales_statements')
        .update({ settlement_period_id: settlementPeriod.id })
        .eq('id', statement.id)
    }

    if (input.lineItems && input.lineItems.length > 0) {
      await createSalesStatementLineItems(
        serviceSupabase,
        input.lineItems.map((item) => ({
          statementId: statement.id,
          releaseId: item.releaseId ?? null,
          platform: item.platform ?? null,
          country: item.country ?? null,
          streams: item.streams ?? 0,
          revenueEur: item.revenueEur ?? 0,
          quantity: item.quantity ?? 0,
        })),
      )
    }

    if (input.notifyArtist) {
      try {
        const { notifyStatementArtist } = await import('@/lib/sos/notifyStatementArtist')
        const emailResult = await notifyStatementArtist(serviceSupabase, statement, fetch)
        if (emailResult.success) {
          const { updateSalesStatementStatus } = await import('@/lib/api/salesStatements')
          await updateSalesStatementStatus(serviceSupabase, statement.id, 'artist_notified')
        } else {
          console.warn('[uploadStatement] Email notification skipped:', emailResult.error)
        }
      } catch (emailErr) {
        console.error('[uploadStatement] Email notification failed:', emailErr)
      }
    }

    return { success: true, statementId: statement.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('[uploadStatement] Error:', err)
    return { success: false, error: message }
  }
}

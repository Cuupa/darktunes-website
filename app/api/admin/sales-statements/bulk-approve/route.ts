import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import {
  approveAndNotifySalesStatement,
  getSalesStatementById,
  linkApprovedStatementToSettlement,
} from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { notifyStatementArtist } from '@/lib/sos/notifyStatementArtist'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const bulkApproveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  notes: z.string().max(4000).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const body: unknown = await req.json()
  const parsed = bulkApproveSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const results: {
    id: string
    success: boolean
    emailSent?: boolean
    error?: string
    emailError?: string
  }[] = []

  for (const id of parsed.data.ids) {
    try {
      const existing = await getSalesStatementById(supabase, id)
      if (!existing) {
        results.push({ id, success: false, error: 'Statement not found' })
        continue
      }
      if (existing.status !== 'draft') {
        results.push({ id, success: false, error: `Cannot approve statement in status "${existing.status}"` })
        continue
      }

      const outcome = await approveAndNotifySalesStatement(
        supabase,
        id,
        (statement) => notifyStatementArtist(serviceSupabase, statement),
        parsed.data.notes,
      )

      await linkApprovedStatementToSettlement(supabase, outcome.statement, userId)

      results.push({
        id,
        success: true,
        emailSent: outcome.emailSent,
        emailError: outcome.emailError,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approval failed'
      results.push({ id, success: false, error: message })
    }
  }

  const approved = results.filter((result) => result.success).length
  const emailed = results.filter((result) => result.emailSent).length

  return NextResponse.json({
    approved,
    emailed,
    results,
  })
})
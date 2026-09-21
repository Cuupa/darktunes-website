import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import {
  approveAndNotifySalesStatement,
  linkApprovedStatementToSettlement,
} from '@/lib/api/salesStatements'
import { assertStatementPeriodWritable } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { emitNotification } from '@/lib/notifications/emit'
import { notifyStatementArtist } from '@/lib/sos/notifyStatementArtist'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
const approveSchema = z.object({
  notes: z.string().max(4000).optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  const body: unknown = await req.json()
  const parsed = approveSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  await assertStatementPeriodWritable(supabase, id)

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const outcome = await approveAndNotifySalesStatement(
    supabase,
    id,
    (statement) => notifyStatementArtist(serviceSupabase, statement),
    parsed.data.notes,
  )

  await linkApprovedStatementToSettlement(supabase, outcome.statement, userId)

  if (outcome.emailSent) {
    try {
      await emitNotification(serviceSupabase, {
        type: 'statement_available',
        entityId: outcome.statement.id,
        entityName: outcome.statement.period || outcome.statement.filename || 'New statement',
        artistId: outcome.statement.artistId,
        dedupeKey: `statement_available:${outcome.statement.id}`,
      })
    } catch (err) {
      console.error('[sales-statements/approve] in-app notification failed:', err)
    }
  }

  return NextResponse.json({
    statement: outcome.statement,
    emailSent: outcome.emailSent,
    emailError: outcome.emailError,
  })
})

import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import { notifyApprovedSalesStatement } from '@/lib/api/salesStatements'
import { assertStatementPeriodWritable } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { emitNotification } from '@/lib/notifications/emit'
import { notifyStatementArtist } from '@/lib/sos/notifyStatementArtist'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  const supabase = await createServerSupabaseClient()
  await assertStatementPeriodWritable(supabase, id)

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const outcome = await notifyApprovedSalesStatement(supabase, id, (statement) =>
    notifyStatementArtist(serviceSupabase, statement),
  )

  await logFinancialEvent(supabase, {
    entityType: 'sales_statement',
    entityId: id,
    action: 'notify',
    actorId: userId,
    afterData: {
      email_sent: outcome.emailSent,
      email_error: outcome.emailError ?? null,
    },
  })

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
      console.error('[sales-statements/notifications] in-app notification failed:', err)
    }
  }

  return NextResponse.json({
    statement: outcome.statement,
    email_sent: outcome.emailSent,
    email_error: outcome.emailError ?? null,
  })
})

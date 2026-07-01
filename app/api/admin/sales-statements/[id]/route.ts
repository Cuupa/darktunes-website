import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import {
  deleteSalesStatementDraft,
  getSalesStatementById,
  StatementNotDeletableError,
} from '@/lib/api/salesStatements'
import { assertStatementPeriodWritable } from '@/lib/api/settlementPeriods'
import { deleteStatementPdfFromR2 } from '@/lib/portal/statementPdfStorage'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing statement id')

  const supabase = await createServerSupabaseClient()
  await assertStatementPeriodWritable(supabase, id)

  const existing = await getSalesStatementById(supabase, id)
  if (!existing) throw new ApiError(404, 'Statement not found')

  try {
    const deleted = await deleteSalesStatementDraft(supabase, id)
    await deleteStatementPdfFromR2(deleted.r2Key)

    await logFinancialEvent(supabase, {
      entityType: 'sales_statement',
      entityId: id,
      action: 'draft_deleted',
      actorId: userId,
      beforeData: {
        artistId: deleted.artistId,
        period: deleted.period,
        amountEur: deleted.amountEur,
        status: deleted.status,
      },
    })

    return NextResponse.json({ deleted: true, id })
  } catch (err) {
    if (err instanceof StatementNotDeletableError) {
      throw new ApiError(409, err.message)
    }
    throw err
  }
})
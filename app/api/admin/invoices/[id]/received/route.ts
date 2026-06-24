import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { markInvoiceReceived } from '@/lib/api/artistInvoices'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const supabase = await createServerSupabaseClient()
  const invoice = await markInvoiceReceived(supabase, id, userId)

  await logFinancialEvent(supabase, {
    entityType: 'artist_invoice',
    entityId: id,
    action: 'mark_received',
    actorId: userId,
    afterData: { status: invoice.status, received_at: invoice.receivedAt },
  })

  return NextResponse.json({ invoice })
})
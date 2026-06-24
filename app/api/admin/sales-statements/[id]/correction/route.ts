import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createCorrectionStatement } from '@/lib/api/salesStatements'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const correctionSchema = z.object({
  amount_eur: z.number(),
  label_notes: z.string().max(4000).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  const body: unknown = await req.json()
  const parsed = correctionSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  const statement = await createCorrectionStatement(
    supabase,
    id,
    {
      amountEur: parsed.data.amount_eur,
      labelNotes: parsed.data.label_notes,
    },
    userId,
  )

  await logFinancialEvent(supabase, {
    entityType: 'sales_statement',
    entityId: statement.id,
    action: 'create_correction',
    actorId: userId,
    afterData: {
      correction_of_id: id,
      amount_eur: parsed.data.amount_eur,
    },
  })

  return NextResponse.json({ statement }, { status: 201 })
})
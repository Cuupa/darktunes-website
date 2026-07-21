import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { lockSettlementPeriod } from '@/lib/api/settlementPeriods'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing period id')

  const supabase = await createServerSupabaseClient()
  const period = await lockSettlementPeriod(supabase, id, userId)
  return NextResponse.json({ period })
})
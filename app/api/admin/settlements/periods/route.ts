import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { listSettlementPeriods } from '@/lib/api/settlementPeriods'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const supabase = await createServerSupabaseClient()
  const periods = await listSettlementPeriods(supabase)
  return NextResponse.json({ periods })
})
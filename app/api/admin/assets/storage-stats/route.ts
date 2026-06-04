import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface StorageStatsResponse {
  usedBytes: number
}

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('size_bytes')

  if (error) throw new Error(error.message)

  const usedBytes = (data ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0)
  return NextResponse.json({ usedBytes } satisfies StorageStatsResponse)
})

/**
 * GET /api/admin/ai/diagnostics
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)
  const { data, error } = await serviceClient
    .from('ai_diagnostics')
    .select('id, error_reference, fingerprint, analysis_status, classification, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return NextResponse.json({
    items: data ?? [],
    next_cursor: null,
  })
})

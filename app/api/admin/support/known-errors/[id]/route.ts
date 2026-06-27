/**
 * DELETE /api/admin/support/known-errors/[id]
 * Auth: admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { deleteKnownError } from '@/lib/api/zammadSupport'

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const segments = req.nextUrl.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) {
    throw new ApiError(400, 'Missing id')
  }

  const db = await createServiceRoleSupabaseClient()
  await deleteKnownError(db, id)

  return NextResponse.json({ ok: true })
})
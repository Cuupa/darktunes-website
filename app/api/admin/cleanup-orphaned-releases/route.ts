/**
 * app/api/admin/cleanup-orphaned-releases/route.ts
 *
 * POST /api/admin/cleanup-orphaned-releases
 * Auth: Bearer <supabase-access-token> (admin or editor role required)
 *
 * Deletes all releases whose artist_id is NULL (orphaned — no linked artist).
 * Returns { deleted: number }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import type { Database } from '@/types/database'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, 'Supabase is not configured')
  }

  // Use service-role client to bypass RLS (delete requires admin role via RLS,
  // but service role ensures this works regardless of the caller's Supabase JWT)
  const db = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await db
    .from('releases')
    .delete()
    .is('artist_id', null)
    .select('id')

  if (error) throw new ApiError(500, `Cleanup failed: ${error.message}`)

  return NextResponse.json({ deleted: (data ?? []).length })
})

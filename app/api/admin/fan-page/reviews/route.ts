/**
 * GET /api/admin/fan-page/reviews — list fan pages for admin review
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { listFanPageReviews } from '@/lib/api/fanPageDocument'
import { fanPagePublishStatusSchema } from '@/lib/fan-page/schema/documentV1'

const querySchema = z.object({
  status: fanPagePublishStatusSchema.optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const parsed = querySchema.safeParse({
    status: req.nextUrl.searchParams.get('status') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const reviews = await listFanPageReviews(supabase, parsed.data.status)
  return NextResponse.json(reviews)
})
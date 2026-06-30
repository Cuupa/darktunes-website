/**
 * POST — Admin approve/reject Fan Page
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { reviewFanPage } from '@/lib/api/fanPageDocument'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'

const bodySchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)
  const artistId = req.nextUrl.pathname.split('/').at(-2)
  if (!artistId) throw new ApiError(400, 'Missing artist id')
  const body = bodySchema.parse(await req.json())

  const supabase = await createServerSupabaseClient()

  const { data: artist } = await supabase
    .from('artists')
    .select('slug')
    .eq('id', artistId)
    .maybeSingle()

  if (!artist) throw new ApiError(404, 'Artist not found')

  const result = await reviewFanPage(supabase, artistId, body.approved, userId, body.comment)

  if (result.publishStatus === 'published') {
    revalidateTag(`fan-page-${artist.slug}`, 'max')
  }

  return NextResponse.json(result)
})
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reorderPressKit } from '@/lib/api/pressKit'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface ReorderBody {
  artistId?: string | null
  orderedItemIds?: string[]
}

export const PATCH = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const body = (await request.json()) as ReorderBody
  const orderedItemIds = body.orderedItemIds?.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  ) ?? []

  if (orderedItemIds.length === 0) {
    throw new ApiError(400, 'orderedItemIds must contain at least one id')
  }

  const artistId = body.artistId === undefined ? null : body.artistId

  const supabase = await createServerSupabaseClient()
  await reorderPressKit(supabase, artistId, orderedItemIds)

  revalidateTag('press-kit', 'max')

  return NextResponse.json({ success: true })
})
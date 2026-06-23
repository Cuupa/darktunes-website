import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { bulkSetPressApproved } from '@/lib/api/assets'
import { bulkAddToPressKit, bulkRemoveFromPressKitByAssetIds } from '@/lib/api/pressKit'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type BulkPressAction = 'approve' | 'unapprove' | 'addToKit' | 'removeFromKit'

interface BulkPressBody {
  assetIds?: string[]
  action?: BulkPressAction
  artistId?: string | null
}

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const body = (await request.json()) as BulkPressBody
  const assetIds = body.assetIds?.filter((id): id is string => typeof id === 'string' && id.length > 0) ?? []

  if (assetIds.length === 0) throw new ApiError(400, 'At least one asset id is required')
  if (!body.action) throw new ApiError(400, 'action is required')

  const supabase = await createServerSupabaseClient()
  const artistId = body.artistId === undefined ? null : body.artistId

  let affected = 0

  switch (body.action) {
    case 'approve':
      affected = await bulkSetPressApproved(supabase, assetIds, true)
      break
    case 'unapprove':
      affected = await bulkSetPressApproved(supabase, assetIds, false)
      break
    case 'addToKit': {
      const items = await bulkAddToPressKit(supabase, assetIds, artistId)
      affected = items.length
      revalidateTag('press-kit')
      break
    }
    case 'removeFromKit':
      affected = await bulkRemoveFromPressKitByAssetIds(supabase, assetIds, artistId)
      revalidateTag('press-kit')
      break
    default:
      throw new ApiError(400, `Unknown action: ${String(body.action)}`)
  }

  if (body.action === 'approve' || body.action === 'unapprove') {
    revalidateTag('press-kit')
  }

  return NextResponse.json({ success: true, affected })
})
/**
 * app/api/admin/assets/[id]/route.ts — Admin asset deletion Route Handler
 *
 * Deletes an asset record from Supabase AND its corresponding object from
 * Cloudflare R2, keeping storage in sync with the database.
 *
 * Security:
 *   1. ****** verified via Supabase — admin or editor role required.
 *   2. R2 credentials are loaded from validated server env.
 *   3. All errors handled uniformly via withErrorHandler.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteAssetRecord } from '@/lib/api/assets'
import { createR2Client, deleteObjectFromR2 } from '@/lib/r2Utils'
import { eventBus } from '@/domain/events/eventBus'

/** Extract the asset [id] segment from the URL path. */
function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing asset id')

  const supabase = await createServerSupabaseClient()

  // Look up the asset to get its R2 key before deleting
  const { data: row, error: fetchError } = await supabase
    .from('assets')
    .select('id, r2_key')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw new ApiError(500, fetchError.message)
  if (!row) throw new ApiError(404, 'Asset not found')

  // Delete the R2 object first; if this fails the DB record stays intact
  const { serverEnv } = await import('@/lib/env.server')
  const r2 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  await deleteObjectFromR2(row.r2_key, r2, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)

  // Delete the DB record
  await deleteAssetRecord(supabase, id)

  eventBus.emit({ type: 'asset.deleted', assetId: id })

  return NextResponse.json({ success: true })
})

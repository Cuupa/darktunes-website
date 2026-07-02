/**
 * GET /api/admin/sos/import-batches/[id]/presign-download — presigned GET URL for browser → R2 download
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getImportBatchById } from '@/lib/api/distributorImportBatches'
import { generateBronzePresignedDownloadUrl } from '@/lib/sos/bronzePresignedUpload'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/presign-download\/?$/)
  return match?.[1] ?? null
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid presign-download path')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (!batch.fileHash) throw new ApiError(409, 'Import batch has no archived content yet')

  const downloadUrl = await generateBronzePresignedDownloadUrl(batch.r2Key)

  return NextResponse.json({ downloadUrl, r2Key: batch.r2Key })
})
import { NextRequest, NextResponse } from 'next/server'
import { batchDeleteMediaFiles } from '@/lib/api/mediaFiles'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteR2MediaObjects, getMediaFilesForDeletion } from '../_utils'

interface BatchDeleteBody {
  ids?: string[]
}

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const body = (await request.json()) as BatchDeleteBody
  const ids = body.ids?.filter((id): id is string => typeof id === 'string' && id.length > 0) ?? []
  if (ids.length === 0) throw new ApiError(400, 'At least one file id is required')

  const supabase = await createServerSupabaseClient()
  const files = await getMediaFilesForDeletion(supabase, ids)

  await deleteR2MediaObjects(files)
  await batchDeleteMediaFiles(supabase, ids)

  return NextResponse.json({ success: true, deleted: files.length })
})

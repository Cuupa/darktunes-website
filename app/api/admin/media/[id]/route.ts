import { NextRequest, NextResponse } from 'next/server'
import { deleteMediaFileRecord, updateMediaFile } from '@/lib/api/mediaFiles'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteR2MediaObjects, getMediaFilesForDeletion } from '../_utils'

interface PatchMediaFileBody {
  folderId?: string | null
  tags?: string[]
  originalFilename?: string
}

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing media file id')

  const body = (await request.json()) as PatchMediaFileBody
  const updates: PatchMediaFileBody = {}
  if ('folderId' in body) updates.folderId = body.folderId ?? null
  if ('tags' in body) updates.tags = body.tags ?? []
  if ('originalFilename' in body) updates.originalFilename = body.originalFilename?.trim() ?? ''
  if (Object.keys(updates).length === 0) throw new ApiError(400, 'No changes provided')

  const supabase = await createServerSupabaseClient()
  const asset = await updateMediaFile(supabase, id, updates)

  return NextResponse.json({ asset })
})

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing media file id')

  const supabase = await createServerSupabaseClient()
  const files = await getMediaFilesForDeletion(supabase, [id])
  const file = files[0]
  if (!file) throw new ApiError(404, 'Media file not found')

  await deleteR2MediaObjects([file])
  await deleteMediaFileRecord(supabase, id)

  return NextResponse.json({ success: true })
})

import { NextRequest, NextResponse } from 'next/server'
import { batchDeleteMediaFiles } from '@/lib/api/mediaFiles'
import { deleteMediaFolder, getMediaFolders, moveMediaFolder, renameMediaFolder } from '@/lib/api/mediaFolders'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { collectDescendantMediaFolderIds, deleteR2MediaObjects, getMediaFilesInFolders } from '../../_utils'

interface PatchFolderBody {
  name?: string
  parentId?: string | null
}

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

function isDescendant(targetId: string, folderId: string, folders: Awaited<ReturnType<typeof getMediaFolders>>): boolean {
  let currentId: string | null = targetId
  while (currentId) {
    if (currentId === folderId) return true
    currentId = folders.find((folder) => folder.id === currentId)?.parentId ?? null
  }
  return false
}

export const PATCH = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing folder id')

  const body = (await request.json()) as PatchFolderBody
  const supabase = await createServerSupabaseClient()

  let folder = null
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) throw new ApiError(400, 'Folder name is required')
    folder = await renameMediaFolder(supabase, id, name)
  }

  if ('parentId' in body) {
    if (body.parentId === id) throw new ApiError(400, 'Folder cannot be moved into itself')
    if (body.parentId) {
      const folders = await getMediaFolders(supabase)
      if (isDescendant(body.parentId, id, folders)) {
        throw new ApiError(400, 'Folder cannot be moved into one of its descendants')
      }
    }
    folder = await moveMediaFolder(supabase, id, body.parentId ?? null)
  }

  if (!folder) throw new ApiError(400, 'No folder changes provided')

  return NextResponse.json({ folder })
})

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing folder id')

  const supabase = await createServerSupabaseClient()
  const folderIds = await collectDescendantMediaFolderIds(supabase, id)
  const files = await getMediaFilesInFolders(supabase, folderIds)

  await deleteR2MediaObjects(files)
  await batchDeleteMediaFiles(supabase, files.map((file) => file.id))
  await deleteMediaFolder(supabase, id)

  return NextResponse.json({ success: true, deletedFiles: files.length, deletedFolders: folderIds.length })
})

import { NextRequest, NextResponse } from 'next/server'
import { createMediaFolder, getMediaFolders } from '@/lib/api/mediaFolders'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface CreateFolderBody {
  name?: string
  parentId?: string | null
}

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const supabase = await createServerSupabaseClient()
  const folders = await getMediaFolders(supabase)
  return NextResponse.json({ folders })
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  const userId = await verifyPermission(token, 'can_view_admin_panel')

  const body = (await request.json()) as CreateFolderBody
  const name = body.name?.trim()
  if (!name) throw new ApiError(400, 'Folder name is required')

  const supabase = await createServerSupabaseClient()
  const folder = await createMediaFolder(supabase, name, body.parentId ?? null, userId)
  return NextResponse.json({ folder }, { status: 201 })
})

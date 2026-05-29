import { NextRequest, NextResponse } from 'next/server'
import { createFolder, getFolders } from '@/lib/api/assetFolders'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface CreateFolderBody {
  name?: string
  parentId?: string | null
  artistId?: string | null
}

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const supabase = await createServerSupabaseClient()
  const folders = await getFolders(supabase)
  return NextResponse.json({ folders })
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const body = (await request.json()) as CreateFolderBody
  const name = body.name?.trim()
  if (!name) throw new ApiError(400, 'Folder name is required')

  const supabase = await createServerSupabaseClient()
  const folder = await createFolder(supabase, name, body.parentId ?? null, body.artistId ?? null, userId)
  return NextResponse.json({ folder }, { status: 201 })
})

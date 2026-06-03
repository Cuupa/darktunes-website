import { NextRequest, NextResponse } from 'next/server'
import { getMediaFilesByFolder, searchMediaFiles } from '@/lib/api/mediaFiles'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const folderId = searchParams.get('folderId')

  const assets = search
    ? await searchMediaFiles(supabase, search)
    : await getMediaFilesByFolder(supabase, folderId ?? null)

  return NextResponse.json({ assets })
})

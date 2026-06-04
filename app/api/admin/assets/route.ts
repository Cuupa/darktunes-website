import { NextRequest, NextResponse } from 'next/server'
import { getAssetsByArtist, getAssetsByFolder, searchAssets } from '@/lib/api/assets'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const folderId = searchParams.get('folderId')
  const artistId = searchParams.get('artistId')

  const assets = search
    ? await searchAssets(supabase, search)
    : artistId
      ? await getAssetsByArtist(supabase, artistId)
      : await getAssetsByFolder(supabase, folderId ?? null)

  return NextResponse.json({ assets })
})

import { NextRequest, NextResponse } from 'next/server'
import { getAssetsByArtist, getAssetsByFolder, getPressAssets, searchAssets } from '@/lib/api/assets'
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
  const pressOnly = searchParams.get('pressOnly') === '1'
  const pressSuggested = searchParams.get('pressSuggested') === '1'
  const pressCategory = searchParams.get('pressCategory')?.trim()

  const assets = search
    ? await searchAssets(supabase, search)
    : pressOnly || pressSuggested || pressCategory
      ? await getPressAssets(supabase, {
          isPressApproved: pressOnly ? true : undefined,
          pressSuggested: pressSuggested ? true : undefined,
          pressCategory: pressCategory || undefined,
          artistId: artistId ?? undefined,
        })
      : artistId
        ? await getAssetsByArtist(supabase, artistId)
        : await getAssetsByFolder(supabase, folderId ?? null)

  return NextResponse.json({ assets })
})

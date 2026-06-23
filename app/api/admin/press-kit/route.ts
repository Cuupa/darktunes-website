import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { addToPressKit, getPressKitItems } from '@/lib/api/pressKit'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface AddPressKitBody {
  assetId?: string
  artistId?: string | null
  displayOrder?: number
}

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const artistIdParam = searchParams.get('artistId')

  const items = artistIdParam === 'label'
    ? await getPressKitItems(supabase, null)
    : artistIdParam
      ? await getPressKitItems(supabase, artistIdParam)
      : await getPressKitItems(supabase)

  return NextResponse.json({ items })
})

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const body = (await request.json()) as AddPressKitBody
  if (!body.assetId) throw new ApiError(400, 'assetId is required')

  const artistId = body.artistId === undefined ? null : body.artistId

  const supabase = await createServerSupabaseClient()
  const item = await addToPressKit(supabase, {
    assetId: body.assetId,
    artistId,
    displayOrder: body.displayOrder,
  })

  revalidateTag('press-kit')

  return NextResponse.json({ item }, { status: 201 })
})
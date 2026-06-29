import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { removeFromPressKit } from '@/lib/api/pressKit'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const DELETE = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const id = extractId(request)
  if (!id) throw new ApiError(400, 'Missing press kit item id')

  const supabase = await createServerSupabaseClient()
  await removeFromPressKit(supabase, id)

  revalidateTag('press-kit', 'max')

  return NextResponse.json({ success: true })
})
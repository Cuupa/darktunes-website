import { NextRequest, NextResponse } from 'next/server'
import { recordStatementView } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  const { supabase, artist } = await authenticatePortalBearerWithArtist(req)
  const statement = await recordStatementView(supabase, id, artist.id)

  return NextResponse.json({ statement })
})
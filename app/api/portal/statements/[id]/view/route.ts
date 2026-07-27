import { NextRequest, NextResponse } from 'next/server'
import { recordStatementView } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { portalMemberWrite, withPortalMembership } from '@/lib/portal/withPortalMembership'

const ROUTE = 'POST /api/portal/statements/[id]/view'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing statement id')

  // Optional artistId: falls back to first membership (legacy clients)
  const artistId =
    req.nextUrl.searchParams.get('artistId') ?? req.nextUrl.searchParams.get('artist_id')
  const ctx = await withPortalMembership(req, artistId)

  const { value: statement } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'sales_statements', operation: 'update' },
    (db) => recordStatementView(db, id, ctx.artist.id),
  )

  return NextResponse.json({ statement })
})

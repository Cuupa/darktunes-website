import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { getPublishedPortalFaq } from '@/lib/api/portalFaq'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await authenticatePortalBearer(req)
  const tree = await getPublishedPortalFaq(supabase)
  return NextResponse.json({ tree })
})
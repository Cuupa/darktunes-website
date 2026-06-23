/**
 * app/api/portal/epk/templates/route.ts
 *
 * GET — list published EPK starter templates (portal auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { listPublishedEpkTemplates } from '@/lib/api/epkTemplates'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await authenticatePortalBearer(req)
  const templates = await listPublishedEpkTemplates(supabase)
  return NextResponse.json({ templates })
})
/**
 * GET /api/admin/support/status
 * Auth: admin only
 * Returns Zammad connection readiness (no external call).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { getZammadConfig } from '@/lib/zammad/config'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const config = getZammadConfig()

  return NextResponse.json({
    configured: config !== null,
    group: config?.group ?? null,
  })
})
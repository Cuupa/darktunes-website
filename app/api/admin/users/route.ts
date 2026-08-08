/**
 * app/api/admin/users/route.ts
 *
 * GET /api/admin/users
 * Returns all registered users enriched with their profile role and
 * any linked artist.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { listUsersWithProfiles } from '@/lib/api/users'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)
  const users = await listUsersWithProfiles(serviceClient)
  return NextResponse.json({ users })
})

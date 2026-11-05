import { NextRequest, NextResponse } from 'next/server'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getSyncOverview } from '@/lib/api/syncOverview'
import { z } from 'zod'

/** GET /api/admin/sync/artist-states — paginated artist/provider checkpoints. */
export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)
  const params = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.uuid().optional(),
  }).safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!params.success) throw new ApiError(400, 'Use a limit from 1 to 100 and a valid artist cursor.', 'VALIDATION_ERROR')
  const result = await getSyncOverview(serviceClient, params.data.limit, params.data.cursor)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
})

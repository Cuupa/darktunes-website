import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createConfiguredR2Client } from '@/lib/r2Utils'
import {
  listR2ExplorerPage,
  matchSearchTokens,
} from '@/lib/r2/explorer'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const { s3, bucket } = await createConfiguredR2Client()
  const { searchParams } = new URL(request.url)
  const prefix = searchParams.get('prefix')?.trim() || null
  const cursor = searchParams.get('cursor')?.trim() || null
  const search = searchParams.get('search')?.trim()
  const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw))) : DEFAULT_LIMIT

  if (search && search.length > 0) {
    // Search spans all objects under the (optional) prefix: budget-paginated
    // full listing, then client-side token filtering.
    let objects: Array<{ key: string; sizeBytes: number; lastModified: Date | null }> = []
    let nextCursor: string | null = null
    let truncated = false
    const deadline = Date.now() + 45_000
    for (;;) {
      if (Date.now() >= deadline) { truncated = true; break }
      const page = await listR2ExplorerPage(s3, bucket, { prefix, cursor: nextCursor, limit: 1000 })
      objects = objects.concat(page.objects)
      nextCursor = page.nextCursor
      if (!nextCursor) break
    }
    objects = objects.filter((object) => matchSearchTokens(object.key, search))
    objects.sort((a, b) => b.sizeBytes - a.sizeBytes)
    const pageObjects = objects.slice(0, limit)
    truncated = truncated || objects.length > limit
    return NextResponse.json({
      objects: pageObjects,
      nextCursor: null,
      truncated,
      search,
    })
  }

  const page = await listR2ExplorerPage(s3, bucket, { prefix, cursor, limit })
  return NextResponse.json({
    objects: page.objects,
    nextCursor: page.nextCursor,
    truncated: page.truncated,
    search: null,
  })
})

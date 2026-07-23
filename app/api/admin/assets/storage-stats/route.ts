import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, verifyPermission } from '@/lib/adminAuth'
import { withErrorHandler } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

export interface StorageStatsResponse {
  usedBytes: number
  assetCount: number
  limitBytes: number
}

const DEFAULT_LIMIT_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB (R2 free-tier default)

function resolveLimitBytes(): number {
  const raw = process.env.NEXT_PUBLIC_R2_STORAGE_LIMIT_BYTES
  if (!raw) return DEFAULT_LIMIT_BYTES
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT_BYTES
}

/**
 * Fallback when the RPC is not yet deployed: page through size_bytes rows.
 * PostgREST defaults to max 1000 rows per request.
 */
async function sumSizeBytesPaginated(
  supabase: Awaited<ReturnType<typeof createServiceRoleSupabaseClient>>,
): Promise<{ usedBytes: number; assetCount: number }> {
  const pageSize = 1000
  let usedBytes = 0
  let assetCount = 0
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from('assets')
      .select('size_bytes')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = data ?? []
    assetCount += rows.length
    usedBytes += rows.reduce((sum, row) => sum + (row.size_bytes ?? 0), 0)
    if (rows.length < pageSize) break
    from += pageSize
  }

  return { usedBytes, assetCount }
}

export const GET = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyPermission(token, 'can_view_admin_panel')

  const supabase = await createServiceRoleSupabaseClient()
  const limitBytes = resolveLimitBytes()

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_assets_storage_stats')

  if (!rpcError && rpcData != null) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (row && typeof row === 'object' && 'used_bytes' in row) {
      const usedBytes = Number((row as { used_bytes: number | string }).used_bytes) || 0
      const assetCount = Number((row as { asset_count: number | string }).asset_count) || 0
      return NextResponse.json({
        usedBytes,
        assetCount,
        limitBytes,
      } satisfies StorageStatsResponse)
    }
  }

  const { usedBytes, assetCount } = await sumSizeBytesPaginated(supabase)
  return NextResponse.json({ usedBytes, assetCount, limitBytes } satisfies StorageStatsResponse)
})

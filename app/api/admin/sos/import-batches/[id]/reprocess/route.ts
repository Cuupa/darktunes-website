/**
 * POST /api/admin/sos/import-batches/[id]/reprocess
 * Downloads Bronze CSV from R2, re-parses, and optionally persists gold metrics.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getImportBatchById, updateImportBatchStatus } from '@/lib/api/distributorImportBatches'
import { getWorkspaceForPeriod } from '@/lib/api/sosAccountingWorkspaces'
import { createR2Client, downloadObjectFromR2 } from '@/lib/r2Utils'
import { reprocessBronzeCsvContent } from '@/lib/sos/bronzeReprocess'
import type { BronzeDistributor } from '@/lib/sos/bronzeUpload'
import { persistSosAnalyticsCore } from '@/lib/sos/persistSosAnalyticsCore'
import { ApiError, withErrorHandler } from '@/lib/errors'

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
  return user
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/reprocess\/?$/)
  return match?.[1] ?? null
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch path')
  const body = await req.json().catch(() => ({}))
  const { label_artists, persist } = body as {
    label_artists?: Array<{ name: string; artistId?: string }>
    persist?: boolean
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  await updateImportBatchStatus(serviceSupabase, id, 'processing')

  try {
    const csvContent = await downloadObjectFromR2(batch.r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
    const workspace = await getWorkspaceForPeriod(
      serviceSupabase,
      batch.periodStart,
      batch.periodEnd,
    )
    const labelArtists =
      label_artists?.map((artist) => ({
        id: artist.artistId ?? artist.name,
        name: artist.name,
        artistId: artist.artistId,
      })) ?? []

    const result = await reprocessBronzeCsvContent(
      batch.distributor as BronzeDistributor,
      csvContent,
      {
        workspaceConfig: workspace?.config,
        labelArtists,
      },
    )

    let persistResult = null
    if (persist && label_artists && label_artists.length > 0) {
      persistResult = await persistSosAnalyticsCore(serviceSupabase, {
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
        batchIds: [batch.id],
        territoryMetrics: result.territoryMetrics,
        labelArtists: label_artists,
      })
      if (!persistResult.success) {
        throw new ApiError(500, persistResult.error ?? 'Failed to persist analytics')
      }
    } else {
      await updateImportBatchStatus(serviceSupabase, id, 'completed', result.rowCount)
    }

    return NextResponse.json({
      batchId: batch.id,
      rowCount: result.rowCount,
      metricCount: result.territoryMetrics.length,
      uniqueArtists: result.uniqueArtists,
      persisted: Boolean(persist),
      persistResult,
    })
  } catch (err) {
    await updateImportBatchStatus(serviceSupabase, id, 'failed')
    throw err
  }
})
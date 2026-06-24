/**
 * GET  /api/admin/sos/import-batches — list bronze import batches
 * POST /api/admin/sos/import-batches — register a bronze CSV import + presigned upload URL
 */

import { randomUUID, createHash } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createImportBatch, listImportBatches } from '@/lib/api/distributorImportBatches'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedUploadUrl } from '@/lib/portal/presignedUrl'
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
  return { user, supabase }
}

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batches = await listImportBatches(serviceSupabase, 100)
  return NextResponse.json({ batches })
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { user } = await requireAdminOrEditor()
  const body = await req.json()
  const {
    period_start,
    period_end,
    distributor,
    filename,
    file_hash,
    row_count,
  } = body as {
    period_start?: string
    period_end?: string
    distributor?: string
    filename?: string
    file_hash?: string
    row_count?: number
  }

  if (!period_start || !period_end || !distributor || !filename) {
    throw new ApiError(400, 'period_start, period_end, distributor, and filename are required')
  }

  const batchId = randomUUID()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const hashPrefix = file_hash?.slice(0, 12) ?? createHash('sha256').update(`${batchId}-${filename}`).digest('hex').slice(0, 12)
  const r2Key = `sos-imports/${batchId}/${hashPrefix}_${safeName}`

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  const uploadUrl = await generatePresignedUploadUrl(r2Key, 'text/csv', {
    getSignedUrl,
    s3Client: s3,
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  })

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await createImportBatch(serviceSupabase, {
    periodStart: period_start,
    periodEnd: period_end,
    distributor,
    r2Key,
    fileHash: file_hash ?? null,
    rowCount: row_count ?? 0,
    uploadedBy: user.id,
  })

  return NextResponse.json(
    {
      batch,
      uploadUrl,
      r2Key,
    },
    { status: 201 },
  )
})
/**
 * PATCH /api/admin/sos/import-batches/[id]/confirm — verify R2 content and store file hash
 */

import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getImportBatchById } from '@/lib/api/distributorImportBatches'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client, downloadObjectBufferFromR2 } from '@/lib/r2Utils'

async function requireAdminOrEditor() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Unauthorized')
  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['admin', 'editor'].includes(role)) throw new ApiError(403, 'Forbidden')
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/confirm\/?$/)
  return match?.[1] ?? null
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch path')

  const raw = await req.text()
  if (raw.length > 4_096) throw new ApiError(413, 'Confirm payload too large')

  const body = JSON.parse(raw) as { file_hash?: string }
  const fileHash = body.file_hash?.trim()
  if (!fileHash || !/^[a-f0-9]{64}$/i.test(fileHash)) {
    throw new ApiError(400, 'file_hash must be a SHA-256 hex digest')
  }

  const normalizedHash = fileHash.toLowerCase()
  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const objectBytes = await downloadObjectBufferFromR2(
    batch.r2Key,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  )
  const computedHash = createHash('sha256').update(objectBytes).digest('hex')
  if (computedHash !== normalizedHash) {
    throw new ApiError(400, 'file_hash does not match R2 object content')
  }

  const { error } = await serviceSupabase
    .from('distributor_import_batches')
    .update({ file_hash: normalizedHash, status: 'completed' })
    .eq('id', id)

  if (error) throw new ApiError(500, error.message)

  return NextResponse.json({ ok: true })
})
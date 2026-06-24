/**
 * PATCH  /api/admin/sos/import-batches/[id] — mark unconfirmed upload as failed
 * DELETE /api/admin/sos/import-batches/[id] — remove orphan batch (upload never confirmed)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  deleteUnconfirmedImportBatch,
  getImportBatchById,
  updateImportBatchStatus,
} from '@/lib/api/distributorImportBatches'
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
}

function extractBatchIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/import-batches\/([^/]+)\/?$/)
  return match?.[1] ?? null
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch path')

  const raw = await req.text()
  if (raw.length > 256) throw new ApiError(413, 'Payload too large')

  const body = JSON.parse(raw) as { status?: string }
  if (body.status !== 'failed') {
    throw new ApiError(400, 'Only status "failed" is supported')
  }

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (batch.fileHash) {
    throw new ApiError(409, 'Cannot mark a confirmed batch as failed')
  }

  await updateImportBatchStatus(serviceSupabase, id, 'failed')
  return NextResponse.json({ ok: true })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  await requireAdminOrEditor()
  const id = extractBatchIdFromPath(new URL(req.url).pathname)
  if (!id) throw new ApiError(400, 'Invalid import batch path')

  const serviceSupabase = await createServiceRoleSupabaseClient()
  const batch = await getImportBatchById(serviceSupabase, id)
  if (!batch) throw new ApiError(404, 'Import batch not found')
  if (batch.fileHash) {
    throw new ApiError(409, 'Cannot delete a batch with a confirmed upload')
  }

  const deleted = await deleteUnconfirmedImportBatch(serviceSupabase, id)
  if (!deleted) throw new ApiError(404, 'Import batch not found or already confirmed')

  return NextResponse.json({ ok: true })
})
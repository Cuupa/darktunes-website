/**
 * POST /api/purge-release-submission-assets
 *
 * Deletes expired submission audio/cover objects from R2 (30 days after submit).
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { isValidCronSecret } from '@/lib/cronAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createR2Client, deleteObjectFromR2 } from '@/lib/r2Utils'
import {
  clearExpiredSubmissionPointer,
  deleteReleaseSubmissionAsset,
  listExpiredReleaseSubmissionAssets,
} from '@/lib/api/releaseSubmissionAssets'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { serverEnv } = await import('@/lib/env.server')
  const authHeader = req.headers.get('authorization') ?? ''
  if (!serverEnv.CRON_SECRET || !isValidCronSecret(authHeader, serverEnv.CRON_SECRET)) {
    throw new ApiError(401, 'Cron authentication failed.')
  }

  const db = await createServiceRoleSupabaseClient()
  const expired = await listExpiredReleaseSubmissionAssets(db, new Date().toISOString())
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  let deleted = 0
  const errors: string[] = []
  for (const asset of expired) {
    try {
      await deleteObjectFromR2(asset.r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
      await clearExpiredSubmissionPointer(db, asset)
      await deleteReleaseSubmissionAsset(db, asset.id)
      deleted += 1
    } catch (err) {
      errors.push(asset.r2Key)
      console.error(
        '[purge-release-submission-assets]',
        asset.r2Key,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return NextResponse.json({ deleted, remaining_errors: errors.length })
})

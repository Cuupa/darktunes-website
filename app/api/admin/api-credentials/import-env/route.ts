/**
 * POST /api/admin/api-credentials/import-env
 * One-time migration: import legacy env vars into encrypted api_credentials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { importCredentialsFromEnv } from '@/lib/api/importCredentialsFromEnv'
import { invalidateCredentialCache } from '@/lib/secrets/getExternalCredentials'

function mapImportError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err)

  if (message.includes('API_CREDENTIALS_ENCRYPTION_KEY')) {
    throw new ApiError(
      500,
      'API_CREDENTIALS_ENCRYPTION_KEY is missing or invalid on this deployment. Set a 64-character hex key in Vercel, then redeploy.',
      'MISSING_CONFIG',
    )
  }

  if (message.includes('api_credentials') && message.includes('does not exist')) {
    throw new ApiError(
      500,
      'The api_credentials table is missing. Run the latest supabase/reset.sql in the Supabase SQL Editor, then retry.',
      'MISSING_SCHEMA',
    )
  }

  throw err instanceof Error ? err : new Error(message)
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()

  let result
  try {
    result = await importCredentialsFromEnv(db, userId)
  } catch (err) {
    mapImportError(err)
  }

  invalidateCredentialCache()

  return NextResponse.json(result)
})
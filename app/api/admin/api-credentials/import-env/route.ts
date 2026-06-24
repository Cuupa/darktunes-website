/**
 * POST /api/admin/api-credentials/import-env
 * One-time migration: import legacy env vars into encrypted api_credentials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  getDecryptedCredential,
  listCredentialStatus,
  upsertCredential,
} from '@/lib/api/apiCredentials'
import { CREDENTIAL_KEY_DEFINITIONS } from '@/lib/secrets/credentialKeys'
import { invalidateCredentialCache } from '@/lib/secrets/getExternalCredentials'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const db = await createServiceRoleSupabaseClient()
  const imported: string[] = []
  const skipped: string[] = []

  for (const def of CREDENTIAL_KEY_DEFINITIONS) {
    if (!def.envVar) continue

    const existing = await getDecryptedCredential(db, def.key)
    if (existing) {
      skipped.push(def.key)
      continue
    }

    const envValue = process.env[def.envVar]?.trim()
    if (!envValue) {
      skipped.push(def.key)
      continue
    }

    await upsertCredential(db, {
      key: def.key,
      value: envValue,
      updatedBy: userId,
    })
    imported.push(def.key)
  }

  invalidateCredentialCache()
  const credentials = await listCredentialStatus(db)

  return NextResponse.json({ imported, skipped, credentials })
})
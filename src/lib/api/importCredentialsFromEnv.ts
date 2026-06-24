/**
 * One-time migration: copy legacy Vercel env vars into encrypted api_credentials.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getDecryptedCredential,
  listCredentialStatus,
  upsertCredential,
  type CredentialStatusRow,
} from '@/lib/api/apiCredentials'
import { CREDENTIAL_KEY_DEFINITIONS } from '@/lib/secrets/credentialKeys'

type DbClient = SupabaseClient<Database>

export type ImportSkipReason = 'already_configured' | 'env_missing' | 'no_env_mapping'

export interface ImportSkippedEntry {
  key: string
  envVar: string | null
  reason: ImportSkipReason
}

export interface ImportEnvVarStatus {
  envVar: string
  present: boolean
}

export interface ImportCredentialsFromEnvResult {
  imported: string[]
  skipped: ImportSkippedEntry[]
  envVarsChecked: ImportEnvVarStatus[]
  credentials: CredentialStatusRow[]
}

export interface ImportCredentialsFromEnvOptions {
  /** Defaults to process.env — inject in tests. */
  readEnv?: (name: string) => string | undefined
}

export async function importCredentialsFromEnv(
  db: DbClient,
  updatedBy: string,
  options: ImportCredentialsFromEnvOptions = {},
): Promise<ImportCredentialsFromEnvResult> {
  const readEnv = options.readEnv ?? ((name: string) => process.env[name])

  const imported: string[] = []
  const skipped: ImportSkippedEntry[] = []
  const envVarsChecked: ImportEnvVarStatus[] = []
  const seenEnvVars = new Set<string>()

  for (const def of CREDENTIAL_KEY_DEFINITIONS) {
    if (!def.envVar) {
      skipped.push({ key: def.key, envVar: null, reason: 'no_env_mapping' })
      continue
    }

    if (!seenEnvVars.has(def.envVar)) {
      seenEnvVars.add(def.envVar)
      envVarsChecked.push({
        envVar: def.envVar,
        present: Boolean(readEnv(def.envVar)?.trim()),
      })
    }

    const existing = await getDecryptedCredential(db, def.key)
    if (existing) {
      skipped.push({ key: def.key, envVar: def.envVar, reason: 'already_configured' })
      continue
    }

    const envValue = readEnv(def.envVar)?.trim()
    if (!envValue) {
      skipped.push({ key: def.key, envVar: def.envVar, reason: 'env_missing' })
      continue
    }

    try {
      await upsertCredential(db, {
        key: def.key,
        value: envValue,
        updatedBy,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('api_credentials_updated_by_fkey')) {
        await upsertCredential(db, {
          key: def.key,
          value: envValue,
          updatedBy: null,
        })
      } else {
        throw err
      }
    }
    imported.push(def.key)
  }

  const credentials = await listCredentialStatus(db)

  return { imported, skipped, envVarsChecked, credentials }
}
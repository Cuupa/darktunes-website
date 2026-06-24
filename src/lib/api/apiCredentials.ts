/**
 * DAL for admin-managed encrypted API credentials (api_credentials table).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  decryptCredential,
  encryptCredential,
  isEncryptedCredentialEnvelope,
} from '@/lib/secrets/credentialCrypto'
import {
  CREDENTIAL_KEY_DEFINITIONS,
  getCredentialDefinition,
  isAllowedCredentialKey,
  type CredentialKey,
} from '@/lib/secrets/credentialKeys'

type DbClient = SupabaseClient<Database>

/** NULL label_id = default single-label tenant. */
export const DEFAULT_LABEL_ID: null = null

export interface CredentialStatusRow {
  key: CredentialKey
  label: string
  description: string
  category: string
  isSecret: boolean
  docsUrl?: string
  configured: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export interface UpsertCredentialInput {
  key: CredentialKey
  value: string
  updatedBy: string | null
  labelId?: string | null
}

function isNonEmptyCredential(value: string): boolean {
  return value.trim().length > 0
}

function isStoredCredential(value: string): boolean {
  return isEncryptedCredentialEnvelope(value)
}

export async function listCredentialStatus(
  db: DbClient,
  labelId: string | null = DEFAULT_LABEL_ID,
): Promise<CredentialStatusRow[]> {
  let query = db.from('api_credentials').select('key, value, updated_at, updated_by')
  if (labelId === null) {
    query = query.is('label_id', null)
  } else {
    query = query.eq('label_id', labelId)
  }

  const { data, error } = await query
  if (error) throw error

  const stored = new Map(
    (data ?? []).map((row) => [
      row.key,
      {
        configured: isStoredCredential(row.value),
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      },
    ]),
  )

  return CREDENTIAL_KEY_DEFINITIONS.map((def) => {
    const row = stored.get(def.key)
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      category: def.category,
      isSecret: def.isSecret,
      docsUrl: def.docsUrl,
      configured: row?.configured ?? false,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  })
}

export async function getDecryptedCredential(
  db: DbClient,
  key: CredentialKey,
  labelId: string | null = DEFAULT_LABEL_ID,
): Promise<string | null> {
  let query = db.from('api_credentials').select('value').eq('key', key)
  if (labelId === null) {
    query = query.is('label_id', null)
  } else {
    query = query.eq('label_id', labelId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data?.value) return null

  try {
    const plaintext = decryptCredential(data.value)
    return isNonEmptyCredential(plaintext) ? plaintext : null
  } catch {
    console.error(`[apiCredentials] Failed to decrypt credential: ${key}`)
    return null
  }
}

export async function getConfiguredCredentialKeys(
  db: DbClient,
  labelId: string | null = DEFAULT_LABEL_ID,
): Promise<Set<CredentialKey>> {
  let query = db.from('api_credentials').select('key, value')
  if (labelId === null) {
    query = query.is('label_id', null)
  } else {
    query = query.eq('label_id', labelId)
  }

  const { data, error } = await query
  if (error) throw error

  const configured = new Set<CredentialKey>()
  for (const row of data ?? []) {
    if (isAllowedCredentialKey(row.key) && isStoredCredential(row.value)) {
      configured.add(row.key)
    }
  }
  return configured
}

export async function upsertCredential(
  db: DbClient,
  input: UpsertCredentialInput,
): Promise<void> {
  const def = getCredentialDefinition(input.key)
  if (!def) {
    throw new Error(`Unknown credential key: ${input.key}`)
  }

  const trimmed = input.value.trim()
  if (!trimmed) {
    await deleteCredential(db, input.key, input.labelId ?? DEFAULT_LABEL_ID)
    return
  }

  const ciphertext = encryptCredential(trimmed)
  const labelId = input.labelId ?? DEFAULT_LABEL_ID

  const { error } = await db.from('api_credentials').upsert(
    {
      label_id: labelId,
      key: input.key,
      value: ciphertext,
      category: def.category,
      updated_by: input.updatedBy,
    },
    { onConflict: 'label_id,key' },
  )
  if (error) throw error
}

export async function deleteCredential(
  db: DbClient,
  key: CredentialKey,
  labelId: string | null = DEFAULT_LABEL_ID,
): Promise<void> {
  let query = db.from('api_credentials').delete().eq('key', key)
  if (labelId === null) {
    query = query.is('label_id', null)
  } else {
    query = query.eq('label_id', labelId)
  }

  const { error } = await query
  if (error) throw error
}
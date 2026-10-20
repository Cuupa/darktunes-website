import type { SupabaseClient } from '@supabase/supabase-js'
import { getApiCredential } from '@/lib/secrets/getExternalCredentials'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

/**
 * Credential priority: encrypted admin key, then NVIDIA_API_KEY env, then none.
 */
export async function resolveNvidiaApiKey(db: DbClient | null): Promise<string | null> {
  if (db) {
    const stored = await getApiCredential(db, 'nvidia_api_key')
    if (stored && stored.trim().length > 0) return stored.trim()
  }
  const envKey = process.env.NVIDIA_API_KEY?.trim()
  return envKey && envKey.length > 0 ? envKey : null
}

export function readNvidiaEnvKey(): string | null {
  const envKey = process.env.NVIDIA_API_KEY?.trim()
  return envKey && envKey.length > 0 ? envKey : null
}

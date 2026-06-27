/**
 * src/lib/health/healthDbClient.ts
 *
 * Cookie-free Supabase client for health read workloads.
 * Uses the read replica when configured; otherwise the primary DB.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createHealthDbClient(): SupabaseClient<Database> | null {
  const supabaseUrl =
    process.env.SUPABASE_REPLICA_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  // Health reads RLS-protected tables from an unauthenticated route — service role required.
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !supabaseKey) return null

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
}
/**
 * src/lib/supabase/replica.ts
 *
 * Read-replica Supabase client for heavy analytics queries.
 *
 * Supabase supports read replicas starting from the Pro plan (configure via
 * Database → Replicas in the Supabase Dashboard). When a replica is available,
 * set SUPABASE_REPLICA_URL and SUPABASE_REPLICA_ANON_KEY to route read-heavy
 * workloads away from the primary DB.
 *
 * Usage:
 *   const client = createReplicaSupabaseClient()
 *   const { data } = await client.from('streaming_stats').select()
 *
 * Appropriate for:
 *   - app/admin/system/ (Health/Logs Dashboard)
 *   - app/portal/analytics/ (Streaming Stats, Sales Charts)
 *   - SOS CSV export endpoints
 *   - Any aggregation query that does not need the latest write
 *
 * Falls back transparently to the primary DB when env vars are not set, so
 * this is safe to use in development environments without a replica.
 *
 * NEVER use this client for writes — it targets a read-only replica.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase client that targets the read replica when configured,
 * or falls back to the primary DB.
 *
 * This is a synchronous factory — it reads env vars at call time.
 * Safe to use in Route Handlers and Server Actions (not in unstable_cache
 * callbacks — use the raw anon-key pattern there instead).
 */
export function createReplicaSupabaseClient() {
  const replicaUrl = process.env.SUPABASE_REPLICA_URL
  const replicaKey = process.env.SUPABASE_REPLICA_ANON_KEY

  // Use replica if both env vars are set; otherwise fall back to primary
  const url = replicaUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = replicaKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

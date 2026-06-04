/**
 * src/lib/supabase/publicClient.ts
 *
 * Cookie-free Supabase client safe for use inside `unstable_cache` callbacks.
 *
 * In Next.js 15, dynamic APIs like `cookies()` and `headers()` cannot be called
 * inside `unstable_cache` callbacks. All data fetched via this client is publicly
 * readable (RLS: FOR SELECT USING (TRUE)) so the anon key without a session
 * cookie is sufficient.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

'use client'
/**
 * src/lib/supabase/client.ts
 *
 * Browser-side Supabase client for Client Components ("use client").
 *
 * Uses @supabase/ssr's createBrowserClient which automatically handles
 * cookie-based session persistence in the browser.
 *
 * Usage:
 *   const client = createBrowserSupabaseClient()
 *   const { data } = await client.from('releases').select()
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  )
}

/**
 * Browser helper: attach Bearer token for portal API calls.
 * Prefer this over cookie-only fetch so routes can use membership helpers.
 */

import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/** Returns Authorization header map, or empty object if no session. */
export async function getPortalAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

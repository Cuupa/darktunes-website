import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/** Returns the current Supabase session JWT for admin API calls from client components. */
export async function getAdminAccessToken(): Promise<string> {
  const supabase = createBrowserSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}
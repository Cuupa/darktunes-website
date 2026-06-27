import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export async function tourPlannerToken(): Promise<string> {
  const { data } = await createBrowserSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function tourPlannerFetch(
  artistId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await tourPlannerToken()
  const sep = path.includes('?') ? '&' : '?'
  const url = `/api/portal/tour-planner${path}${sep}artistId=${encodeURIComponent(artistId)}`
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
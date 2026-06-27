import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { enqueueMutation } from '@/lib/tour-planner/offline/syncQueue'
import { getTourPlannerDb } from '@/lib/tour-planner/offline/database'

export async function tourPlannerToken(): Promise<string> {
  const { data } = await createBrowserSupabaseClient().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function tourPlannerFetchDirect(
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

async function markSynced(): Promise<void> {
  await getTourPlannerDb().meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() })
}

export function wasQueuedOffline(res: Response): boolean {
  return res.status === 202
}

export async function parseTourPlannerJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Tour planner request failed (${res.status})`)
  return res.json() as Promise<T>
}

export async function tourPlannerFetch(
  artistId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const isMutation = method !== 'GET' && method !== 'HEAD'

  if (typeof navigator !== 'undefined' && !navigator.onLine && isMutation) {
    const body = typeof init?.body === 'string' ? init.body : init?.body ? JSON.stringify(init.body) : null
    await enqueueMutation(artistId, path, method, body)
    return new Response(JSON.stringify({ ok: true, offline: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await tourPlannerFetchDirect(artistId, path, init)
    if (res.ok && typeof navigator !== 'undefined' && navigator.onLine) {
      await markSynced()
    }
    return res
  } catch (error) {
    if (isMutation && typeof navigator !== 'undefined' && !navigator.onLine) {
      const body = typeof init?.body === 'string' ? init.body : null
      await enqueueMutation(artistId, path, method, body)
      return new Response(JSON.stringify({ ok: true, offline: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }
}
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type TestClient = SupabaseClient<Database>

type ArtistRouteRow = Pick<Database['public']['Tables']['artists']['Row'], 'slug'>
type ReleaseRouteRow = Pick<Database['public']['Tables']['releases']['Row'], 'id'>

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const configured = Boolean(url && anonKey)

  return {
    configured,
    url: url ?? 'https://placeholder.supabase.co',
    anonKey: anonKey ?? 'placeholder-anon-key',
  }
}

export function createTestSupabaseClient(): TestClient {
  const { url, anonKey } = getSupabaseConfig()
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getVisibleArtists(limit = 20): Promise<ArtistRouteRow[]> {
  const { configured } = getSupabaseConfig()
  if (!configured) return []

  const client = createTestSupabaseClient()
  const { data, error } = await client
    .from('artists')
    .select('slug')
    .eq('is_visible', true)
    .not('slug', 'is', null)
    .limit(limit)

  if (error) throw error
  return (data ?? []).filter((row): row is ArtistRouteRow => Boolean(row.slug))
}

export async function getVisibleReleases(limit = 20): Promise<ReleaseRouteRow[]> {
  const { configured } = getSupabaseConfig()
  if (!configured) return []

  const client = createTestSupabaseClient()
  const { data, error } = await client
    .from('releases')
    .select('id')
    .eq('is_visible', true)
    .order('release_date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).filter((row): row is ReleaseRouteRow => Boolean(row.id))
}

export function isSupabaseE2EConfigured() {
  return getSupabaseConfig().configured
}

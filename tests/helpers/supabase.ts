import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type TestClient = SupabaseClient<Database>

type ArtistRouteRow = Pick<Database['public']['Tables']['artists']['Row'], 'slug'>
type ReleaseRouteRow = Pick<Database['public']['Tables']['releases']['Row'], 'id'>

/** A DB is always available for E2E runs (see tests/e2e/global-setup.ts), so
 * this throws instead of silently falling back to a placeholder client. */
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY — run `npm run db:e2e:start` to provision the local Supabase stack.',
    )
  }

  return { url, anonKey }
}

export function createTestSupabaseClient(): TestClient {
  const { url, anonKey } = getSupabaseConfig()
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getVisibleArtists(limit = 20): Promise<ArtistRouteRow[]> {
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

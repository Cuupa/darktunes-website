import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type ArtistState = Database['public']['Tables']['sync_artist_state']['Row']
type ProviderState = Database['public']['Tables']['sync_provider_limits']['Row']

export interface SyncOverview {
  items: Array<{ artist_id: string; artist_name: string; states: ArtistState[] }>
  providers: ProviderState[]
  next_cursor: string | null
}

/** Page artists, not logs: every artist appears even before its first sync. */
export async function getSyncOverview(db: DbClient, limit: number, cursor?: string): Promise<SyncOverview> {
  let query = db.from('artists').select('id, name').order('id', { ascending: true }).limit(limit + 1)
  if (cursor) query = query.gt('id', cursor)
  const [artists, providers] = await Promise.all([
    query,
    db.from('sync_provider_limits').select('*').order('provider'),
  ])
  if (artists.error) throw artists.error
  if (providers.error) throw providers.error
  const page = (artists.data ?? []).slice(0, limit)
  const states = page.length
    ? await db.from('sync_artist_state').select('*').in('artist_id', page.map((artist) => artist.id))
    : { data: [], error: null }
  if (states.error) throw states.error
  const byArtist = new Map<string, ArtistState[]>()
  for (const state of states.data ?? []) {
    const list = byArtist.get(state.artist_id) ?? []
    list.push(state)
    byArtist.set(state.artist_id, list)
  }
  return {
    items: page.map((artist) => ({ artist_id: artist.id, artist_name: artist.name, states: byArtist.get(artist.id) ?? [] })),
    providers: providers.data ?? [],
    next_cursor: (artists.data?.length ?? 0) > limit ? page.at(-1)!.id : null,
  }
}

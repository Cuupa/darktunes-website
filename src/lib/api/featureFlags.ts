import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PortalFeatureFlag } from '@/types'

type DbClient = SupabaseClient<Database>
type FlagRow = Database['public']['Tables']['portal_feature_flags']['Row']

function rowToFlag(row: FlagRow): PortalFeatureFlag {
  return {
    id: row.id,
    label: row.label,
    enabled: row.enabled,
    targetRole: row.target_role as 'artist' | 'journalist',
    updatedAt: row.updated_at,
  }
}

export async function getFeatureFlags(db: DbClient): Promise<PortalFeatureFlag[]> {
  const { data, error } = await db
    .from('portal_feature_flags')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToFlag)
}

export async function getFeatureFlagsForRole(
  db: DbClient,
  role: 'artist' | 'journalist',
): Promise<Record<string, boolean>> {
  const { data, error } = await db
    .from('portal_feature_flags')
    .select('id, enabled')
    .eq('target_role', role)
  if (error) throw new Error(error.message)
  const map: Record<string, boolean> = {}
  for (const row of data ?? []) {
    map[row.id] = row.enabled
  }
  return map
}

export async function updateFeatureFlag(
  db: DbClient,
  id: string,
  enabled: boolean,
): Promise<PortalFeatureFlag> {
  const { data, error } = await db
    .from('portal_feature_flags')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateFeatureFlag')
  return rowToFlag(data)
}

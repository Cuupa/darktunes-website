import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SubmissionReleaseTypeRule } from '@/types'
import type { SubmissionReleaseType, TrackCountMode } from '@/lib/submissions/fieldTypes'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['submission_release_type_rules']['Row']
type Insert = Database['public']['Tables']['submission_release_type_rules']['Insert']

function rowToRule(row: Row): SubmissionReleaseTypeRule {
  return {
    id: row.id,
    releaseType: row.release_type as SubmissionReleaseType,
    trackCountMode: row.track_count_mode as TrackCountMode,
    minTracks: row.min_tracks,
    maxTracks: row.max_tracks,
    displayOrder: row.display_order,
  }
}

export async function getReleaseTypeRules(db: DbClient): Promise<SubmissionReleaseTypeRule[]> {
  const { data, error } = await db
    .from('submission_release_type_rules')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToRule)
}

export async function upsertReleaseTypeRule(
  db: DbClient,
  rule: Omit<Insert, 'id'> & { id?: string },
): Promise<SubmissionReleaseTypeRule> {
  const { data, error } = await db
    .from('submission_release_type_rules')
    .upsert(rule, { onConflict: 'release_type' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertReleaseTypeRule')
  return rowToRule(data)
}

export function ruleToApiPayload(
  rule: Partial<SubmissionReleaseTypeRule>,
): Omit<Insert, 'id'> & { id?: string } {
  return {
    id: rule.id,
    release_type: rule.releaseType!,
    track_count_mode: rule.trackCountMode!,
    min_tracks: rule.minTracks ?? 1,
    max_tracks: rule.maxTracks ?? 99,
    display_order: rule.displayOrder ?? 0,
  }
}
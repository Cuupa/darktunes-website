import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface LogEditorActivityInput {
  action: string
  entityType: string
  entityId: string
  entityName?: string
  changes?: unknown
}

export async function logEditorActivity(
  supabase: SupabaseClient<Database>,
  input: LogEditorActivityInput,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'editor') return

    await supabase.from('editor_activity_log').insert({
      editor_id: user.id,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      entity_name: input.entityName ?? null,
      changes: (input.changes ?? null) as Database['public']['Tables']['editor_activity_log']['Insert']['changes'],
    })
  } catch {
    // Activity logging should never block primary CRUD workflows.
  }
}

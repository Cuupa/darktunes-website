'use server'

/**
 * Server action: persist gold-layer SOS analytics to the portal database.
 */

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import {
  persistSosAnalyticsCore,
  type PersistSosAnalyticsInput,
  type PersistSosAnalyticsResult,
} from '@/lib/sos/persistSosAnalyticsCore'

export type { PersistSosAnalyticsInput, PersistSosAnalyticsResult }

export async function persistSosAnalytics(
  input: PersistSosAnalyticsInput,
): Promise<PersistSosAnalyticsResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const role = await getUserRoleWithClient(supabase, user.id)
    if (!role || !['admin', 'editor'].includes(role)) {
      return { success: false, error: 'Forbidden: admin or editor role required' }
    }

    const serviceSupabase = await createServiceRoleSupabaseClient()
    return persistSosAnalyticsCore(serviceSupabase, input)
  } catch (err) {
    console.error('[persistSosAnalytics] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveEffectiveAccess } from './resolveAccess'
import { hasCapability } from './guards'
import type { SystemCapability } from './types'

/**
 * Server-side defense-in-depth for sensitive admin pages.
 * Proxy already gates `/admin/*`; this re-validates before rendering.
 */
export async function requirePageCapability(capability: SystemCapability): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=unauthorized')
  }

  const access = await resolveEffectiveAccess(supabase, user.id)
  if (!hasCapability(access, capability)) {
    redirect('/login?error=unauthorized')
  }
}
/**
 * src/lib/routeUserContext.ts
 *
 * Resolves authenticated user context from API route requests.
 * Server-only — used by withErrorHandler for error attribution.
 */

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { getUserRoleWithClient } from '@/lib/getUserRole'

export interface RouteUserContext {
  userId: string | null
  userRole: string | null
}

const EMPTY_CONTEXT: RouteUserContext = { userId: null, userRole: null }

export async function extractRouteUserContext(req: NextRequest): Promise<RouteUserContext> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return EMPTY_CONTEXT

    const authHeader = req.headers.get('authorization') ?? ''
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      if (token) {
        const admin = createClient<Database>(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        })
        const { data: userData, error } = await admin.auth.getUser(token)
        if (!error && userData.user) {
          const role = await getUserRoleWithClient(admin, userData.user.id)
          return { userId: userData.user.id, userRole: role }
        }
      }
    }

    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const role = await getUserRoleWithClient(supabase, user.id)
      return { userId: user.id, userRole: role }
    }
  } catch {
    // Best-effort attribution — never block error responses
  }

  return EMPTY_CONTEXT
}
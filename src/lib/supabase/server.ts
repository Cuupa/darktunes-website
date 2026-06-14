/**
 * src/lib/supabase/server.ts
 *
 * Server-side Supabase client for Next.js Server Components, Route Handlers,
 * and Server Actions.
 *
 * Uses @supabase/ssr which reads/writes cookies via next/headers, ensuring
 * the session is correctly forwarded to all server-side requests.
 *
 * Usage:
 *   const client = await createServerSupabaseClient()
 *   const { data } = await client.from('releases').select()
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const { serverEnv } = await import('@/lib/env.server')

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll is called from a Server Component — cookies can only be
            // set inside Route Handlers or Server Actions. This is safe to ignore.
          }
        },
      },
    },
  )
}

/**
 * Admin client that uses the service-role key.
 * Only use in trusted server-side contexts (Route Handlers, Server Actions).
 * Never expose this to the browser.
 *
 * Uses `createClient` from `@supabase/supabase-js` directly (no cookie adapter)
 * so that the service-role key is always sent as the Authorization header and
 * RLS is bypassed for every request.  Using `createServerClient` (from
 * @supabase/ssr) here would cause the client to pick up the logged-in admin's
 * session JWT from cookies and use *that* as the Authorization header instead,
 * making all PostgREST queries run under the admin's role (with RLS applied)
 * rather than as the service-role principal.
 */
export async function createServiceRoleSupabaseClient() {
  const { serverEnv } = await import('@/lib/env.server')

  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

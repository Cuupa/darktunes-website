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
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
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
 * Uses serverEnv to ensure all required credentials are present and validated
 * before creating the client. Throws at import if env vars are missing.
 */
export async function createServiceRoleSupabaseClient() {
  const { serverEnv } = await import('@/lib/env.server')
  const cookieStore = await cookies()

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
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
            // Safe to ignore in Server Components
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

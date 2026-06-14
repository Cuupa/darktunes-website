import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Fetches a user's role from the database.
 * Wrapped in React's `cache` to deduplicate identical calls during the same server request.
 */
export const getUserRole = cache(async (userId: string): Promise<string | null> => {
  const { createServerClient } = await import('@supabase/ssr')
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const { serverEnv } = await import('@/lib/env.server')

  const supabase = createServerClient<Database>(
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
            // safe to ignore
          }
        },
      },
    },
  )
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return profile?.role ?? null
})

/**
 * Fetches a user's role from the database using a specific admin client.
 * This is useful for contexts like API route auth checks where a specific JWT
 * client is created (like in adminAuth.ts).
 * Wrapped in React's `cache` to deduplicate identical calls during the same server request.
 */
export const getUserRoleWithClient = cache(async (
  client: ReturnType<typeof createClient<Database>>,
  userId: string
): Promise<string | null> => {
  const { data: profile } = await client
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return profile?.role ?? null
})

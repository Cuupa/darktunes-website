import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env, isSupabaseConfigured } from '@/env'

export { isSupabaseConfigured }

export const supabase = createClient<Database>(
  env?.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

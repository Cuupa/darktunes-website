import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env, isSupabaseConfigured } from '@/env'

export { isSupabaseConfigured }

export const supabase = createClient<Database>(
  env?.VITE_SUPABASE_URL ?? '',
  env?.VITE_SUPABASE_ANON_KEY ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/**
 * Returns true when real Supabase credentials are present (not CI placeholders).
 */
export function isSupabaseEnvConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return false
  if (url === 'https://placeholder.supabase.co') return false
  if (key === 'placeholder-anon-key' || key === 'placeholder-anon-key-for-ci-build') return false
  if (key.startsWith('placeholder-')) return false

  return true
}
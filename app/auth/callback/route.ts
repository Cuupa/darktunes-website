import { resolveRedirectPath } from '@/lib/auth/resolveRedirectPath'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types/users'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createServerSupabaseClient()
  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Fetch the user's role from the profiles table to decide where to redirect.
  // This runs server-side after the session cookie is set, so the user is
  // already authenticated at this point.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: UserRole | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    role = (profile?.role as UserRole | null) ?? null
  }

  const destination = resolveRedirectPath(role)
  return NextResponse.redirect(`${origin}${destination}`)
}

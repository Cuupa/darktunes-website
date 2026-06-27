import { resolveRedirectPath } from '@/lib/auth/resolveRedirectPath'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types/users'
import type { Database } from '@/types/database'

function recoveryLoginUrl(origin: string, params?: Record<string, string>): string {
  const search = new URLSearchParams({ type: 'recovery', ...params })
  return `${origin}/login?${search}`
}

async function exchangeRecoveryCode(
  request: NextRequest,
  code: string,
  origin: string,
): Promise<NextResponse> {
  const destination = recoveryLoginUrl(origin, { exchanged: '1' })
  let response = NextResponse.redirect(destination)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.redirect(destination)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Drop any active session so the emailed account receives the recovery session.
  await supabase.auth.signOut()

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError) {
    const failureResponse = NextResponse.redirect(recoveryLoginUrl(origin, { error: 'auth_failed' }))
    for (const cookie of response.cookies.getAll()) {
      failureResponse.cookies.set(cookie.name, cookie.value)
    }
    return failureResponse
  }

  return response
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const isRecovery = searchParams.get('recovery') === '1'

  if (!code) {
    const missingTarget = isRecovery
      ? recoveryLoginUrl(origin, { error: 'missing_code' })
      : `${origin}/login?error=missing_code`
    return NextResponse.redirect(missingTarget)
  }

  if (isRecovery) {
    return exchangeRecoveryCode(request, code, origin)
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
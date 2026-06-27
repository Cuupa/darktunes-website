import { resolveRedirectPath } from '@/lib/auth/resolveRedirectPath'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types/users'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function recoveryLoginUrl(origin: string, params?: Record<string, string>): string {
  const search = new URLSearchParams({ type: 'recovery', ...params })
  return `${origin}/login?${search}`
}

function createRecoveryCookieClient(request: NextRequest, destination: string) {
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

  return { supabase, getResponse: () => response }
}

function recoveryFailureResponse(
  origin: string,
  sessionResponse: NextResponse,
): NextResponse {
  const failureResponse = NextResponse.redirect(recoveryLoginUrl(origin, { error: 'auth_failed' }))
  for (const cookie of sessionResponse.cookies.getAll()) {
    failureResponse.cookies.set(cookie.name, cookie.value)
  }
  return failureResponse
}

async function establishRecoverySession(
  request: NextRequest,
  origin: string,
  authenticate: (
    supabase: SupabaseClient<Database>,
  ) => Promise<{ error: { message: string } | null }>,
): Promise<NextResponse> {
  const destination = recoveryLoginUrl(origin, { exchanged: '1' })
  const { supabase, getResponse } = createRecoveryCookieClient(request, destination)

  await supabase.auth.signOut()

  const { error } = await authenticate(supabase)

  if (error) {
    return recoveryFailureResponse(origin, getResponse())
  }

  return getResponse()
}

async function exchangeRecoveryCode(
  request: NextRequest,
  code: string,
  origin: string,
): Promise<NextResponse> {
  return establishRecoverySession(request, origin, async (supabase) => {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return { error }
  })
}

async function verifyRecoveryTokenHash(
  request: NextRequest,
  tokenHash: string,
  origin: string,
): Promise<NextResponse> {
  return establishRecoverySession(request, origin, async (supabase) => {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    })
    return { error }
  })
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const isRecovery = searchParams.get('recovery') === '1' || searchParams.get('type') === 'recovery'

  if (isRecovery && tokenHash) {
    return verifyRecoveryTokenHash(request, tokenHash, origin)
  }

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
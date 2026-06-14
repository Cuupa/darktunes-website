/**
 * middleware.ts — Next.js Edge Middleware
 *
 * Intercepts all requests BEFORE the page renders, allowing auth checks
 * to redirect unauthenticated users away from /admin without any client-side
 * "flicker" (i.e. no momentary flash of protected content).
 *
 * Auth strategy:
 *   - Any request to /admin/* (except /admin/login) requires a valid
 *     Supabase session cookie AND a role of 'admin' or 'editor'.
 *   - If no session is found, redirect to /admin/login.
 *   - If a session exists but the role is insufficient, redirect to /admin/login?error=unauthorized.
 *   - If a session with sufficient role exists and the user visits /admin/login, redirect to /admin.
 *
 * The middleware also refreshes the Supabase session cookie on every request
 * so tokens stay alive for active users.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_ROLES = new Set(['admin', 'editor'])

export async function middleware(request: NextRequest) {
  // Guard: if Supabase env vars are missing, skip auth checks.
  // In production, these vars are always set (Vercel injects them at build time).
  // In local dev without .env.local, admin routes are unprotected but non-functional.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session — do not run any code between createServerClient
  // and getUser() or the session might not update properly.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isLoginPage = pathname === '/login'
  const isAdminRoute = pathname.startsWith('/admin')
  const isEditorRoute = pathname.startsWith('/editor')

  const isPortalAcceptInvitePage = pathname === '/portal/accept-invite'
  const isPortalRoute = pathname.startsWith('/portal')
  const isPressDashboardRoute = pathname.startsWith('/press/dashboard')
  const isPromoPoolRoute = pathname.startsWith('/promo-pool')
  const isAccountRoute = pathname.startsWith('/account')

  const isProtectedRoute = isAdminRoute || isEditorRoute || isPortalRoute || isPressDashboardRoute || isPromoPoolRoute || isAccountRoute

  // Fetch the user's role once for all route sections that need it.
  // This avoids repeated round-trips to the users table within the same
  // middleware invocation when a request touches multiple guarded areas.
  let profile: { role: string } | null = null
  if (user && (isProtectedRoute || isLoginPage)) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  // Central Login Redirection Logic for Authenticated Users
  if (isLoginPage && user && profile) {
    if (['admin'].includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    } else if (['editor'].includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/editor'
      return NextResponse.redirect(url)
    } else if (['journalist'].includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/press/dashboard'
      return NextResponse.redirect(url)
    } else {
      // Default / artist fallback
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !isLoginPage && !isPortalAcceptInvitePage && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // --- Admin/Editor route protection ---
  if ((isAdminRoute || isEditorRoute) && user) {
    const hasAdminAccess = profile ? ADMIN_ROLES.has(profile.role) : false

    if (isAdminRoute && profile?.role === 'editor') {
      const editorUrl = request.nextUrl.clone()
      editorUrl.pathname = '/editor'
      return NextResponse.redirect(editorUrl)
    }
    if (!hasAdminAccess) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Portal route protection ---
  if (isPortalRoute && !isPortalAcceptInvitePage && user) {
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      // Check artist_members (junction table) — the link-artist API writes here
      const { data: membership } = await supabase
        .from('artist_members')
        .select('artist_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('error', 'no_artist')
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  // --- Press Dashboard protection ---
  if (isPressDashboardRoute && user) {
    if (!profile || !['journalist', 'admin'].includes(profile.role)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Account route protection (/account/*) ---
  // (Handled by the generic unauthenticated check above, but if they are logged in, allow access to /account)

  // -------------------------------------------------------------------------
  // Locale detection — set NEXT_LOCALE cookie from Accept-Language if missing
  // -------------------------------------------------------------------------
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  if (!cookieLocale || (cookieLocale !== 'en' && cookieLocale !== 'de')) {
    const acceptLanguage = request.headers.get('accept-language') ?? ''
    const primary = acceptLanguage.split(',')[0]?.split(';')[0]?.trim().split('-')[0]?.toLowerCase()
    const detectedLocale = primary === 'en' ? 'en' : 'de'
    supabaseResponse.cookies.set('NEXT_LOCALE', detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })
  }

  // Forward the current pathname as a request header so Server Components
  // (e.g. app/portal/layout.tsx) can read it without importing next/headers
  // in a way that requires a client context.
  supabaseResponse.headers.set('x-pathname', pathname)
  // Forward the full URL (including query string) so portal layout can extract ?artistId
  supabaseResponse.headers.set('x-url', request.url)

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/portal/:path*',
    '/press/:path*',
    '/promo-pool/:path*',
    '/account/:path*',
    '/login',
  ],
}

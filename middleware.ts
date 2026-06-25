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
import { isEditorAllowedAdminPath } from '@/lib/editor/editorAdminPaths'
import { hasPortalArtistMembership } from '@/lib/portal/membership'
import { isSupabaseEnvConfigured } from '@/lib/supabase/isConfigured'

const ADMIN_ROLES = new Set(['admin', 'editor'])

function classifyRoute(pathname: string) {
  return {
    isLoginPage: pathname === '/login',
    isAdminRoute: pathname.startsWith('/admin'),
    isEditorRoute: pathname.startsWith('/editor'),
    isPortalAcceptInvitePage: pathname === '/portal/accept-invite',
    isPortalRoute: pathname.startsWith('/portal'),
    isPressDashboardRoute: pathname.startsWith('/press/dashboard'),
    isPromoPoolRoute: pathname.startsWith('/promo-pool'),
    isAccountRoute: pathname.startsWith('/account'),
  }
}

function routeIsProtected(flags: ReturnType<typeof classifyRoute>): boolean {
  return (
    flags.isAdminRoute ||
    flags.isEditorRoute ||
    flags.isPortalRoute ||
    flags.isPressDashboardRoute ||
    flags.isPromoPoolRoute ||
    flags.isAccountRoute
  )
}

function redirectUnauthenticatedToLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('returnTo', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const route = classifyRoute(pathname)
  const protectedRoute = routeIsProtected(route)

  // CI placeholder credentials: enforce route redirects without calling Supabase
  // (avoids slow/hanging auth against fake hosts while keeping protected routes gated).
  if (!isSupabaseEnvConfigured()) {
    if (protectedRoute && !route.isLoginPage && !route.isPortalAcceptInvitePage) {
      return redirectUnauthenticatedToLogin(request)
    }
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

  const isLoginPage = route.isLoginPage
  const isAdminRoute = route.isAdminRoute
  const isEditorRoute = route.isEditorRoute
  const isPortalAcceptInvitePage = route.isPortalAcceptInvitePage
  const isPortalRoute = route.isPortalRoute
  const isPressDashboardRoute = route.isPressDashboardRoute
  const isProtectedRoute = protectedRoute

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
    const returnTo = request.nextUrl.searchParams.get('returnTo')
    const url = request.nextUrl.clone()

    // Validate returnTo to prevent open redirects (only allow local paths)
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      url.pathname = returnTo
      url.search = '' // Clear query params after redirecting back
      return NextResponse.redirect(url)
    }

    if (['admin'].includes(profile.role)) {
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    } else if (['editor'].includes(profile.role)) {
      url.pathname = '/editor'
      return NextResponse.redirect(url)
    } else if (['journalist'].includes(profile.role)) {
      url.pathname = '/press/dashboard'
      return NextResponse.redirect(url)
    } else {
      // Default / artist fallback
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !isLoginPage && !isPortalAcceptInvitePage && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('returnTo', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // --- Admin/Editor route protection ---
  if ((isAdminRoute || isEditorRoute) && user) {
    const hasAdminAccess = profile ? ADMIN_ROLES.has(profile.role) : false

    if (isEditorRoute && profile?.role === 'admin') {
      const adminUrl = request.nextUrl.clone()
      adminUrl.pathname = '/admin'
      adminUrl.search = ''
      return NextResponse.redirect(adminUrl)
    }

    if (isEditorRoute && profile && !ADMIN_ROLES.has(profile.role)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }

    if (isAdminRoute && profile?.role === 'editor' && !isEditorAllowedAdminPath(pathname)) {
      const editorUrl = request.nextUrl.clone()
      editorUrl.pathname = '/editor'
      editorUrl.search = ''
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
      let hasMembership = false
      try {
        hasMembership = await hasPortalArtistMembership(supabase, user.id)
      } catch {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/login'
        loginUrl.searchParams.set('error', 'no_artist')
        return NextResponse.redirect(loginUrl)
      }

      if (!hasMembership) {
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
    '/editor/:path*',
    '/portal/:path*',
    '/press/:path*',
    '/promo-pool/:path*',
    '/account/:path*',
    '/login',
  ],
}

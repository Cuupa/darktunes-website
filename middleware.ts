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

  const routeMatchers = {
    isAdminLogin: pathname === '/admin/login',
    isAdmin: pathname.startsWith('/admin'),
    isEditor: pathname.startsWith('/editor'),
    isPortalLogin: pathname === '/portal/login',
    isPortalAcceptInvite: pathname === '/portal/accept-invite',
    isPortal: pathname.startsWith('/portal'),
    isPressLogin: pathname === '/press/login',
    isPressDashboard: pathname.startsWith('/press/dashboard'),
    isAccount: pathname.startsWith('/account'),
    isPromoPoolLogin: pathname === '/promo-pool/login',
    isPromoPool: pathname.startsWith('/promo-pool'),
  }

  // Fetch the user's role once for all route sections that need it.
  // This avoids repeated round-trips to the users table within the same
  // middleware invocation when a request touches multiple guarded areas.
  let profile: { role: string } | null = null
  if (
    user &&
    (routeMatchers.isAdmin || routeMatchers.isEditor || routeMatchers.isPortal || routeMatchers.isPressLogin || routeMatchers.isPressDashboard)
  ) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  // --- Admin route protection ---

  // Redirect unauthenticated users away from protected admin/editor routes
  if ((routeMatchers.isAdmin && !routeMatchers.isAdminLogin && !user) || (routeMatchers.isEditor && !user)) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  // For authenticated users on admin/editor routes (or the admin login page), check the role
  if ((routeMatchers.isAdmin || routeMatchers.isEditor) && user) {
    const hasAdminAccess = profile ? ADMIN_ROLES.has(profile.role) : false

    if (routeMatchers.isAdminLogin) {
      if (profile?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      if (profile?.role === 'editor') {
        return NextResponse.redirect(new URL('/editor', request.url))
      }
      // Users without admin access may stay on the login page (already rejected above via no-session path)
    } else if (routeMatchers.isAdmin) {
      if (profile?.role === 'editor') {
        return NextResponse.redirect(new URL('/editor', request.url))
      }
      // Protect all other /admin/* routes — deny non-admin/editor roles
      if (!hasAdminAccess) {
        const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
      }
    } else if (routeMatchers.isEditor && !hasAdminAccess) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Portal route protection ---

  // Redirect unauthenticated users away from the artist portal
  if (routeMatchers.isPortal && !routeMatchers.isPortalLogin && !routeMatchers.isPortalAcceptInvite && !user) {
    return NextResponse.redirect(new URL('/portal/login', request.url))
  }

  if (routeMatchers.isPortal && !routeMatchers.isPortalLogin && !routeMatchers.isPortalAcceptInvite && user) {
    // Admins can access the portal without a linked artist
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
        const loginUrl = new URL('/portal/login', request.url)
      loginUrl.searchParams.set('error', 'no_artist')
      return NextResponse.redirect(loginUrl)
      }
    }
  }

  // Redirect already-authenticated portal users away from the login page
  if (routeMatchers.isPortalLogin && user) {
    const isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    // Check artist_members (junction table)
    const { data: membership } = await supabase
      .from('artist_members')
      .select('artist_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
  }

  // Redirect unauthenticated users away from the promo-pool
  if (routeMatchers.isPromoPool && !routeMatchers.isPromoPoolLogin && !user) {
    return NextResponse.redirect(new URL('/promo-pool/login', request.url))
  }

  // Redirect already-authenticated promo-pool users away from the login page
  if (routeMatchers.isPromoPoolLogin && user) {
    return NextResponse.redirect(new URL('/promo-pool', request.url))
  }

  if (routeMatchers.isPressDashboard && !user) {
    return NextResponse.redirect(new URL('/press/login', request.url))
  }

  if (routeMatchers.isPressLogin && user) {
    // Only redirect to dashboard if the user actually has press access.
    // Without this check an authenticated user without a journalist/admin role
    // would be bounced between /press/login and /press/dashboard indefinitely
    // (ERR_TOO_MANY_REDIRECTS).
    if (profile && ['journalist', 'admin'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/press/dashboard', request.url))
    }
    // User is authenticated but lacks press access — stay on login page so the
    // "unauthorized" error message is visible.
  }

  if (routeMatchers.isPressDashboard && user) {
    if (!profile || !['journalist', 'admin'].includes(profile.role)) {
      const loginUrl = new URL('/press/login', request.url)
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Account route protection (/account/*) ---
  if (routeMatchers.isAccount && !user) {
    return NextResponse.redirect(new URL('/portal/login', request.url))
  }

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
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - Public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

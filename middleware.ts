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

  const isAdminLoginPage = pathname === '/admin/login'
  const isAdminRoute = pathname.startsWith('/admin')
  const isEditorRoute = pathname.startsWith('/editor')

  const isPortalLoginPage = pathname === '/portal/login'
  const isPortalRoute = pathname.startsWith('/portal')
  const isPressLoginPage = pathname === '/press/login'
  const isPressDashboardRoute = pathname.startsWith('/press/dashboard')
  const isAccountRoute = pathname.startsWith('/account')

  // Fetch the user's role once for all route sections that need it.
  // This avoids repeated round-trips to the profiles table within the same
  // middleware invocation when a request touches multiple guarded areas.
  let profile: { role: string } | null = null
  if (
    user &&
    (isAdminRoute || isEditorRoute || isPortalRoute || isPressLoginPage || isPressDashboardRoute)
  ) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  // --- Admin route protection ---

  // Redirect unauthenticated users away from protected admin/editor routes
  if ((isAdminRoute && !isAdminLoginPage && !user) || (isEditorRoute && !user)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    return NextResponse.redirect(loginUrl)
  }

  // For authenticated users on admin/editor routes (or the admin login page), check the role
  if ((isAdminRoute || isEditorRoute) && user) {
    const hasAdminAccess = profile ? ADMIN_ROLES.has(profile.role) : false

    if (isAdminLoginPage) {
      if (profile?.role === 'admin') {
        const adminUrl = request.nextUrl.clone()
        adminUrl.pathname = '/admin'
        return NextResponse.redirect(adminUrl)
      }
      if (profile?.role === 'editor') {
        const editorUrl = request.nextUrl.clone()
        editorUrl.pathname = '/editor'
        return NextResponse.redirect(editorUrl)
      }
      // Users without admin access may stay on the login page (already rejected above via no-session path)
    } else if (isAdminRoute) {
      if (profile?.role === 'editor') {
        const editorUrl = request.nextUrl.clone()
        editorUrl.pathname = '/editor'
        return NextResponse.redirect(editorUrl)
      }
      // Protect all other /admin/* routes — deny non-admin/editor roles
      if (!hasAdminAccess) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/admin/login'
        loginUrl.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(loginUrl)
      }
    } else if (isEditorRoute && !hasAdminAccess) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Portal route protection ---

  // Redirect unauthenticated users away from the artist portal
  if (isPortalRoute && !isPortalLoginPage && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/portal/login'
    return NextResponse.redirect(loginUrl)
  }

  if (isPortalRoute && !isPortalLoginPage && user) {
    // Admins can access the portal without a linked artist
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      const { data: linkedArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!linkedArtist) {
        const loginUrl = request.nextUrl.clone()
        loginUrl.pathname = '/portal/login'
        loginUrl.searchParams.set('error', 'no_artist')
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  // Redirect already-authenticated portal users away from the login page
  if (isPortalLoginPage && user) {
    const isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      const portalUrl = request.nextUrl.clone()
      portalUrl.pathname = '/portal'
      return NextResponse.redirect(portalUrl)
    }

    const { data: linkedArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (linkedArtist) {
      const portalUrl = request.nextUrl.clone()
      portalUrl.pathname = '/portal'
      return NextResponse.redirect(portalUrl)
    }
  }

  const isPromoPoolLoginPage = pathname === '/promo-pool/login'
  const isPromoPoolRoute = pathname.startsWith('/promo-pool')

  // Redirect unauthenticated users away from the promo-pool
  if (isPromoPoolRoute && !isPromoPoolLoginPage && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/promo-pool/login'
    return NextResponse.redirect(loginUrl)
  }

  // Redirect already-authenticated promo-pool users away from the login page
  if (isPromoPoolLoginPage && user) {
    const promoUrl = request.nextUrl.clone()
    promoUrl.pathname = '/promo-pool'
    return NextResponse.redirect(promoUrl)
  }

  if (isPressDashboardRoute && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/press/login'
    return NextResponse.redirect(loginUrl)
  }

  if (isPressLoginPage && user) {
    // Only redirect to dashboard if the user actually has press access.
    // Without this check an authenticated user without a journalist/admin role
    // would be bounced between /press/login and /press/dashboard indefinitely
    // (ERR_TOO_MANY_REDIRECTS).
    if (profile && ['journalist', 'admin'].includes(profile.role)) {
      const pressUrl = request.nextUrl.clone()
      pressUrl.pathname = '/press/dashboard'
      return NextResponse.redirect(pressUrl)
    }
    // User is authenticated but lacks press access — stay on login page so the
    // "unauthorized" error message is visible.
  }

  if (isPressDashboardRoute && user) {
    if (!profile || !['journalist', 'admin'].includes(profile.role)) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/press/login'
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }
  }

  // --- Account route protection (/account/*) ---
  if (isAccountRoute && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/portal/login'
    return NextResponse.redirect(loginUrl)
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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Injects the request pathname as the `x-pathname` request header so that
 * `src/i18n/request.ts` can select the correct per-route message bundle via
 * `resolveBundle()` without needing locale-prefixed URLs.
 *
 * The header is forwarded to all Server Components through NextResponse.next().
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    /*
     * Match every path except Next.js internals and static assets.
     * API routes are cheap to pass through — they ignore the header.
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}

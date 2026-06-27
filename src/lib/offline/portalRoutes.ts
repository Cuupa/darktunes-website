/** Portal routes that remain usable when the installed PWA is offline. */
export const PORTAL_OFFLINE_ROUTE_PREFIXES = [
  '/portal/tour-planner',
  '/portal/help',
] as const

export function isPortalOfflineRoute(pathname: string): boolean {
  if (pathname === '/portal') return true
  return PORTAL_OFFLINE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
/** Routes where Lenis is stopped — native scroll inside ScrollableAppShell only. */
export function isDashboardRoute(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return true
  return false
}
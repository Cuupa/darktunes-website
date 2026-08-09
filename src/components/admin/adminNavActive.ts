/**
 * Active-state rules for admin/editor sidebar links.
 * Pure helper — unit-tested without React.
 */

export function isAdminNavActive(
  href: string,
  pathname: string,
  searchParams?: Pick<URLSearchParams, 'get'> | null,
): boolean {
  if (href === '/admin') {
    return pathname === '/admin'
  }

  // Editor home (no tab query) — only when no tab is selected in the URL.
  if (href === '/editor') {
    return pathname === '/editor' && !searchParams?.get('tab')
  }

  if (href.startsWith('/editor?tab=')) {
    if (pathname !== '/editor') return false
    const tab = href.slice('/editor?tab='.length)
    return searchParams?.get('tab') === tab
  }

  const pathOnly = href.split('?')[0] ?? href
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`)
}

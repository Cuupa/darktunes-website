/**
 * Resolves the active navigation href from a list of candidate hrefs.
 *
 * Uses longest-prefix matching so that sibling routes (e.g. /portal/profile
 * vs /portal/epk-builder) highlight exactly one item at a time.
 *
 * The root `/portal` path is treated as an exact-match-only sentinel: it only
 * activates when the pathname is exactly `/portal`, never as a prefix.
 */
export function resolveActiveNavHref(pathname: string, hrefs: string[]): string | null {
  const sorted = [...hrefs].sort((a, b) => b.length - a.length)
  for (const href of sorted) {
    if (href === '/portal') {
      if (pathname === '/portal') return href
      continue
    }
    if (pathname === href || pathname.startsWith(`${href}/`)) return href
  }
  return null
}

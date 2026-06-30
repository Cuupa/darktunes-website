import type { Capability } from './types'

export interface RouteAccessRule {
  /** Path prefix, e.g. `/admin/users` */
  prefix: string
  /** User must hold at least one of these capabilities. */
  anyOf: Capability[]
  /** When true, non-admins also need `artist_members` (portal). */
  requiresArtistMembership?: boolean
}

/** Admin paths that require full admin — editors are redirected away by proxy. */
export const ADMIN_ONLY_PATH_PREFIXES: readonly string[] = [
  '/admin/users',
  '/admin/settings',
  '/admin/api-keys',
  '/admin/features',
  '/admin/analytics',
  '/admin/system',
  '/admin/accounting',
  '/admin/messages',
  '/admin/support',
  '/admin/tour-planner',
  '/admin/submission-form',
  '/admin/accreditations',
  '/admin/press-portal',
  '/admin/statements',
  '/admin/colors',
] as const

export const ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  {
    prefix: '/admin',
    anyOf: ['admin.panel.full', 'admin.panel.editor'],
  },
  {
    prefix: '/editor',
    anyOf: ['admin.panel.editor'],
  },
  {
    prefix: '/press/dashboard',
    anyOf: ['press.dashboard', 'admin.panel.full'],
  },
  {
    prefix: '/portal',
    anyOf: ['portal.access', 'admin.panel.full'],
    requiresArtistMembership: true,
  },
] as const

export function isAdminOnlyAdminPath(pathname: string): boolean {
  return ADMIN_ONLY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function matchRouteRule(pathname: string): RouteAccessRule | null {
  for (const rule of ROUTE_ACCESS_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule
    }
  }
  return null
}
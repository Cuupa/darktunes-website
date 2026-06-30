import type { UserRole } from '@/types/users'

/** @deprecated Enum value — treated as `journalist` everywhere at runtime. */
export const DEPRECATED_PRESS_ROLE = 'press' as const

/** Runtime-active roles (`press` is never returned after normalization). */
export type ActiveUserRole = Exclude<UserRole, 'press'>

const ACTIVE_ROLES = new Set<ActiveUserRole>([
  'admin',
  'editor',
  'journalist',
  'user',
  'artist',
])

/**
 * Maps deprecated `press` to `journalist`. Single source of truth for role aliasing.
 */
export function normalizeRole(role: string | null | undefined): ActiveUserRole | null {
  if (!role) return null
  if (role === DEPRECATED_PRESS_ROLE) return 'journalist'
  if (ACTIVE_ROLES.has(role as ActiveUserRole)) return role as ActiveUserRole
  return null
}

export function normalizeRoles(roles: string[]): ActiveUserRole[] {
  const seen = new Set<ActiveUserRole>()
  for (const role of roles) {
    const normalized = normalizeRole(role)
    if (normalized) seen.add(normalized)
  }
  return [...seen]
}
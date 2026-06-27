import type { UserRole } from '@/types/users'

/**
 * Resolves the post-login destination based on the user's DB role.
 * Single source of truth for role-based routing after sign-in or password recovery.
 */
export function resolveRedirectPath(role: UserRole | null | undefined): string {
  switch (role) {
    case 'admin':
    case 'editor':
      return '/admin'
    case 'artist':
      return '/portal'
    case 'journalist':
      return '/press/dashboard'
    default:
      return '/account'
  }
}

/** redirectTo target for Supabase password recovery emails. */
export function getPasswordRecoveryRedirectUrl(siteUrl?: string): string {
  const base = (siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(
    /\/$/,
    '',
  )
  return `${base}/auth/callback?recovery=1`
}
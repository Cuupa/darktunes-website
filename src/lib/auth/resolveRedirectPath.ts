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

function normalizeSiteUrl(siteUrl?: string): string {
  return (siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(/\/$/, '')
}

/** redirectTo for auth.admin.generateLink (required by API; branded emails use hashed_token URL). */
export function getPasswordRecoveryRedirectUrl(siteUrl?: string): string {
  return `${normalizeSiteUrl(siteUrl)}/auth/callback?recovery=1`
}

/**
 * Direct server-verifiable recovery URL from generateLink hashed_token.
 * Avoids Supabase /verify redirects that may emit PKCE codes without a verifier.
 */
export function buildPasswordRecoveryVerifyUrl(siteUrl: string, hashedToken: string): string {
  const params = new URLSearchParams({
    recovery: '1',
    token_hash: hashedToken,
    type: 'recovery',
  })
  return `${normalizeSiteUrl(siteUrl)}/auth/callback?${params}`
}

/** redirectTo for Supabase resetPasswordForEmail (implicit hash flow lands on /login). */
export function getPasswordRecoveryClientLandingUrl(siteUrl?: string): string {
  return `${normalizeSiteUrl(siteUrl)}/login?type=recovery`
}
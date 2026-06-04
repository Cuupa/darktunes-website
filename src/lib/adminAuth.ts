/**
 * src/lib/adminAuth.ts
 *
 * Shared server-side helpers for verifying admin/editor ******
 * in Next.js Route Handlers.
 *
 * All admin API routes follow the same pattern:
 *   1. Extract the ****** from the Authorization header.
 *   2. Call verifyAdminOrEditor(token) — throws ApiError on failure.
 *   3. Proceed with the protected logic.
 *
 * Centralising this avoids the duplicated `verifyTokenAndRole` helpers
 * that previously lived in every individual route file.
 *
 * NOTE: This module reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * via process.env directly (instead of serverEnv) to avoid coupling the auth
 * check to R2 environment variables, which are validated by serverEnv but
 * irrelevant to authentication. The null-guard below provides the equivalent
 * runtime protection for the two vars actually used here.
 *
 * Usage (inside a withErrorHandler wrapper):
 *   const token = extractBearerToken(req.headers.get('authorization'))
 *   const userId = await verifyAdminOrEditor(token)
 *   // or for granular permission checks:
 *   const userId = await verifyPermission(token, 'can_manage_artists')
 */

import { createClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import type { Database } from '@/types/database'

/** Granular permission keys from the role_permissions table. */
export type RolePermissionKey =
  | 'can_publish_news'
  | 'can_edit_news'
  | 'can_manage_artists'
  | 'can_manage_releases'
  | 'can_manage_videos'
  | 'can_view_admin_panel'

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Parses a `****** Authorization header.
 *
 * @throws ApiError(401) if the header is absent or does not start with "Bearer ".
 */
export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  return authHeader.slice(7)
}

// ---------------------------------------------------------------------------
// Role verification
// ---------------------------------------------------------------------------

/**
 * Verifies that the supplied Supabase access-token belongs to a user with
 * the `admin` or `editor` role.
 *
 * @param token  - The raw JWT obtained from the Authorization: ******
 * @returns      - The authenticated user's UUID on success.
 *
 * @throws ApiError(500) if Supabase credentials are not configured server-side.
 * @throws ApiError(401) if the token is invalid or the user cannot be found.
 * @throws ApiError(403) if the user exists but lacks admin or editor role.
 */
export async function verifyAdminOrEditor(token: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new ApiError(500, 'Supabase service key not configured')
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    throw new ApiError(401, 'Unauthorized')
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileErr) {
    throw new ApiError(500, profileErr.message)
  }

  const role = profile?.role as string | undefined
  if (!role || !['admin', 'editor'].includes(role)) {
    throw new ApiError(403, 'Forbidden')
  }

  return userData.user.id
}

/**
 * Verifies that the supplied Supabase access-token belongs to a user with
 * the `admin` role specifically.
 *
 * @param token  - The raw JWT obtained from the Authorization: ******
 * @returns      - The authenticated user's UUID on success.
 *
 * @throws ApiError(500) if Supabase credentials are not configured server-side.
 * @throws ApiError(401) if the token is invalid or the user cannot be found.
 * @throws ApiError(403) if the user exists but is not an admin.
 */
export async function verifyAdmin(token: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new ApiError(500, 'Supabase service key not configured')
  }

  const adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) {
    throw new ApiError(401, 'Unauthorized')
  }

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileErr) {
    throw new ApiError(500, profileErr.message)
  }

  const role = profile?.role as string | undefined
  if (role !== 'admin') {
    throw new ApiError(403, 'Forbidden: admin role required')
  }

  return userData.user.id
}

// ---------------------------------------------------------------------------
// Permission verification (RBAC)
// ---------------------------------------------------------------------------

/**
 * Verifies that the supplied Supabase access-token belongs to a user whose
 * role has the specified granular permission in the `role_permissions` table.
 *
 * Admin users always pass — their full access cannot be restricted.
 *
 * @param token      - The raw JWT obtained from the Authorization: ******
 * @param permission - The permission column to check (e.g. 'can_manage_artists').
 * @returns          - The authenticated user's UUID on success.
 *
 * @throws ApiError(500) if Supabase credentials are not configured server-side.
 * @throws ApiError(401) if the token is invalid or the user cannot be found.
 * @throws ApiError(403) if the user's role lacks the required permission.
 */
export async function verifyPermission(
  token: string,
  permission: RolePermissionKey,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new ApiError(500, 'Supabase service key not configured')
  }

  const adminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) {
    throw new ApiError(401, 'Unauthorized')
  }

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileErr) {
    throw new ApiError(500, profileErr.message)
  }

  const role = profile?.role as string | undefined
  if (!role) {
    throw new ApiError(403, 'Forbidden')
  }

  // Admin always has all permissions
  if (role === 'admin') {
    return userData.user.id
  }

  const { data: perms, error: permsErr } = await adminClient
    .from('role_permissions')
    .select(permission)
    .eq('role', role)
    .maybeSingle()

  if (permsErr) {
    throw new ApiError(500, permsErr.message)
  }

  const hasPermission = perms?.[permission] === true
  if (!hasPermission) {
    throw new ApiError(403, `Forbidden: missing permission '${permission}'`)
  }

  return userData.user.id
}

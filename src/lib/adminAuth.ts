/**
 * src/lib/adminAuth.ts
 *
 * Shared server-side helpers for verifying admin/editor access
 * in Next.js Route Handlers.
 *
 * All admin API routes follow the same pattern:
 *   1. Extract the token from the Authorization header.
 *   2. Call verifyAdminOrEditor(token) — throws ApiError on failure.
 *   3. Proceed with the protected logic.
 *
 * Permission checks merge system `role_permissions` with supplemental custom roles
 * via `resolveEffectiveAccess` from `src/lib/rbac/`.
 */

import { createClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import type { Database } from '@/types/database'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { resolveEffectiveAccess, hasPermissionKey } from '@/lib/rbac/resolveAccess'
import { hasSyncTriggerAccess } from '@/lib/rbac/guards'

/** Granular permission keys from the role_permissions table. */
export type RolePermissionKey =
  | 'can_publish_news'
  | 'can_edit_news'
  | 'can_manage_artists'
  | 'can_manage_releases'
  | 'can_manage_videos'
  | 'can_view_admin_panel'

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new ApiError(500, 'Supabase service key not configured')
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  })
}

async function authenticateBearerToken(token: string): Promise<{
  userId: string
  client: ReturnType<typeof createServiceRoleClient>
}> {
  const client = createServiceRoleClient()
  const { data: userData, error: userError } = await client.auth.getUser(token)
  if (userError || !userData.user) {
    throw new ApiError(401, 'Unauthorized')
  }
  return { userId: userData.user.id, client }
}

/**
 * Parses a Bearer Authorization header.
 *
 * @throws ApiError(401) if the header is absent or does not start with "Bearer ".
 */
export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header')
  }
  return authHeader.slice(7)
}

/**
 * Verifies that the supplied Supabase access-token belongs to a user with
 * the `admin` or `editor` role.
 */
export async function verifyAdminOrEditor(token: string): Promise<string> {
  const { userId, client } = await authenticateBearerToken(token)
  const role = await getUserRoleWithClient(client, userId)

  if (!role || !['admin', 'editor'].includes(role)) {
    throw new ApiError(403, 'Forbidden')
  }

  return userId
}

/**
 * Verifies that the supplied Supabase access-token belongs to a user with
 * the `admin` role specifically.
 */
export async function verifyAdmin(token: string): Promise<string> {
  const { userId, client } = await authenticateBearerToken(token)
  const role = await getUserRoleWithClient(client, userId)

  if (role !== 'admin') {
    throw new ApiError(403, 'Forbidden: admin role required')
  }

  return userId
}

/**
 * Verifies admin or editor access for sync endpoints (admin, editor, or custom
 * `sync.trigger` capability).
 */
export async function verifySyncTrigger(token: string): Promise<string> {
  const { userId, client } = await authenticateBearerToken(token)
  const role = await getUserRoleWithClient(client, userId)

  if (role === 'admin' || role === 'editor') {
    return userId
  }

  const access = await resolveEffectiveAccess(client, userId)
  if (!hasSyncTriggerAccess(access)) {
    throw new ApiError(403, 'Forbidden')
  }

  return userId
}

/**
 * Verifies that the token holder has the specified granular permission.
 * Admin always passes. Custom roles can grant supplemental permission keys.
 */
export async function verifyPermission(
  token: string,
  permission: RolePermissionKey,
): Promise<string> {
  const { userId, client } = await authenticateBearerToken(token)

  let access: Awaited<ReturnType<typeof resolveEffectiveAccess>>
  try {
    access = await resolveEffectiveAccess(client, userId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to resolve permissions'
    throw new ApiError(500, message)
  }

  if (!hasPermissionKey(access, permission)) {
    throw new ApiError(403, `Forbidden: missing permission '${permission}'`)
  }

  return userId
}
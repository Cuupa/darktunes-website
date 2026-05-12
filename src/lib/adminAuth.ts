/**
 * src/lib/adminAuth.ts
 *
 * Shared server-side helpers for verifying admin/editor Bearer tokens
 * in Next.js Route Handlers.
 *
 * All admin API routes follow the same pattern:
 *   1. Extract the Bearer token from the Authorization header.
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
 */

import { createClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Parses a `Bearer <token>` Authorization header.
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
 * @param token  - The raw JWT obtained from the Authorization: Bearer header.
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

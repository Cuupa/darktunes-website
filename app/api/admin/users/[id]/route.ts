/**
 * app/api/admin/users/[id]/route.ts
 *
 * PATCH /api/admin/users/:id — Update a user's role(s) and/or ban status.
 * DELETE /api/admin/users/:id — Permanently delete a user.
 *
 * Security:
 *   - Only users with role = 'admin' may call these endpoints.
 *   - An admin cannot modify or delete their own account.
 *
 * PATCH body options:
 *   { role }        — legacy single-role update (still supported)
 *   { addRole }     — add one role to the user's role set
 *   { removeRole }  — remove one role from the user's role set
 *   { ban, reason } — ban / unban the user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { updateUserRole, addUserRole, removeUserRole, banUser, deleteUser, logBanAction } from '@/lib/api/users'
import type { UserRole } from '@/types/users'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ROLES = ['admin', 'artist', 'editor', 'journalist', 'user'] as const

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  addRole: z.enum(ROLES).optional(),
  removeRole: z.enum(ROLES).optional(),
  ban: z.boolean().optional(),
  reason: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the [id] segment from the URL. */
function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

/** Shared auth + admin-role check. Returns { user, adminClient }. */
async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)

  if (role !== 'admin') throw new ApiError(403, 'Forbidden')

  const adminClient = await createServiceRoleSupabaseClient()
  return { currentUserId: user.id, adminClient }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { currentUserId, adminClient } = await requireAdmin()

  const targetId = extractId(req)

  if (targetId === currentUserId) {
    throw new ApiError(403, 'You cannot modify your own account')
  }

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { role, addRole, removeRole, ban, reason } = parsed.data

  // Legacy single-role update
  if (role !== undefined) {
    await updateUserRole(adminClient, targetId, role)
  }

  // Multi-role: add a role
  if (addRole !== undefined) {
    await addUserRole(adminClient, targetId, addRole as UserRole, currentUserId)
  }

  // Multi-role: remove a role
  if (removeRole !== undefined) {
    await removeUserRole(adminClient, targetId, removeRole as UserRole)
  }

  if (ban !== undefined) {
    await banUser(adminClient, targetId, ban)
    await logBanAction(adminClient, {
      userId: targetId,
      banned: ban,
      bannedUntil: ban ? new Date(Date.now() + 876000 * 60 * 60 * 1000).toISOString() : null,
      changedBy: currentUserId,
      reason: reason ?? null,
    })
  }

  return NextResponse.json({ success: true })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { currentUserId, adminClient } = await requireAdmin()

  const targetId = extractId(req)

  if (targetId === currentUserId) {
    throw new ApiError(403, 'You cannot delete your own account')
  }

  await deleteUser(adminClient, targetId)

  return NextResponse.json({ success: true })
})


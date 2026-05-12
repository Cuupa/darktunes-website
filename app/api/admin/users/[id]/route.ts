/**
 * app/api/admin/users/[id]/route.ts
 *
 * PATCH /api/admin/users/:id — Update a user's role and/or ban status.
 * DELETE /api/admin/users/:id — Permanently delete a user.
 *
 * Security:
 *   - Only users with role = 'admin' may call these endpoints.
 *   - An admin cannot modify or delete their own account.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { updateUserRole, banUser, deleteUser } from '@/lib/api/users'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  role: z.enum(['admin', 'artist', 'editor', 'journalist', 'user']).optional(),
  ban: z.boolean().optional(),
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')

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
    const message = parsed.error.errors.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { role, ban } = parsed.data

  if (role !== undefined) {
    await updateUserRole(adminClient, targetId, role)
  }

  if (ban !== undefined) {
    await banUser(adminClient, targetId, ban)
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

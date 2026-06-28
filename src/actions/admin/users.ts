'use server'

/**
 * src/actions/admin/users.ts
 *
 * Server Actions for Admin User Management.
 * Replaces the previous Route Handlers in app/api/admin/users/*
 */

import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import {
  listUsersWithProfiles,
  updateUserRole,
  addUserRole,
  removeUserRole,
  banUser,
  deleteUser,
  logBanAction,
} from '@/lib/api/users'
import { requestUserInvite } from '@/lib/auth/requestUserInvite'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import type { UserRole, UserWithProfile } from '@/types/users'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shared auth + admin-role check. Returns { currentUserId, adminClient }. */
async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') throw new Error('Forbidden: admin only')

  const adminClient = await createServiceRoleSupabaseClient()
  return { currentUserId: user.id, adminClient }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function getUsersAction(): Promise<{ success: true; data: UserWithProfile[] } | { success: false; error: string }> {
  try {
    const { adminClient } = await requireAdmin()
    const users = await listUsersWithProfiles(adminClient)
    return { success: true, data: users }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

const ROLES = ['admin', 'artist', 'editor', 'journalist', 'user'] as const

const patchSchema = z.object({
  role: z.enum(ROLES).optional(),
  addRole: z.enum(ROLES).optional(),
  removeRole: z.enum(ROLES).optional(),
  ban: z.boolean().optional(),
  reason: z.string().optional(),
})

export async function updateUserAction(
  targetId: string,
  payload: {
    role?: UserRole
    addRole?: UserRole
    removeRole?: UserRole
    ban?: boolean
    reason?: string
  }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { currentUserId, adminClient } = await requireAdmin()

    if (targetId === currentUserId) {
      throw new Error('You cannot modify your own account')
    }

    const parsed = patchSchema.safeParse(payload)
    if (!parsed.success) {
      const message = parsed.error.issues.map((e) => e.message).join('; ')
      throw new Error(`Validation Error: ${message}`)
    }

    const { role, addRole, removeRole, ban, reason } = parsed.data

    if (role !== undefined) {
      await updateUserRole(adminClient, targetId, role)
    }

    if (addRole !== undefined) {
      await addUserRole(adminClient, targetId, addRole as UserRole, currentUserId)
    }

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

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function deleteUserAction(targetId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { currentUserId, adminClient } = await requireAdmin()

    if (targetId === currentUserId) {
      throw new Error('You cannot delete your own account')
    }

    await deleteUser(adminClient, targetId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

const linkSchema = z.object({
  artistId: z.string().uuid().nullable(),
  memberRole: z.enum(['owner', 'member', 'guest']).optional().default('owner'),
  remove: z.boolean().optional().default(false),
})

export async function linkArtistAction(userId: string, payload: { artistId: string | null, memberRole?: 'owner'|'member'|'guest', remove?: boolean }): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { adminClient } = await requireAdmin()

    const parsed = linkSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error('Invalid artist ID')
    }

    const { artistId, memberRole, remove } = parsed.data

    if (artistId === null) {
      const { error: deleteErr } = await adminClient
        .from('artist_members')
        .delete()
        .eq('user_id', userId)
      if (deleteErr) throw new Error('Database error')
    } else if (remove) {
      const { error: deleteErr } = await adminClient
        .from('artist_members')
        .delete()
        .eq('user_id', userId)
        .eq('artist_id', artistId)
      if (deleteErr) throw new Error('Database error')
    } else {
      const { data: targetArtist, error: lookupErr } = await adminClient
        .from('artists')
        .select('id')
        .eq('id', artistId)
        .maybeSingle()

      if (lookupErr) throw new Error('Database error')
      if (!targetArtist) throw new Error('Artist not found')

      const { error: upsertErr } = await adminClient
        .from('artist_members')
        .upsert({ user_id: userId, artist_id: artistId, member_role: memberRole }, { onConflict: 'user_id,artist_id' })

      if (upsertErr) throw new Error('Database error')
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default('user'),
})

export async function inviteUserAction(payload: { email: string; role: UserRole }): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { adminClient, currentUserId } = await requireAdmin()

    const parsed = inviteSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error('Validation Error: Invalid email or role')
    }
    const { email, role } = parsed.data

    const { resendApiKey, resendFromEmail } = await getEmailCredentials(adminClient)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

    const result = await requestUserInvite(
      adminClient,
      { email, role, grantedBy: currentUserId },
      {
        resendApiKey,
        resendFromEmail: resendFromEmail ?? 'noreply@darktunes.com',
        siteUrl,
        fetch,
      },
    )

    if (result.alreadyRegistered) {
      throw new Error(`A user with email "${email}" already exists.`)
    }

    if (!result.sent) {
      throw new Error(result.error ?? 'Failed to send invite')
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

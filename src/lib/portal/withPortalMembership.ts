/**
 * src/lib/portal/withPortalMembership.ts
 *
 * Single entry for portal mutation handlers:
 *   Bearer auth → resolve membership → userDb + serviceDb
 *
 * Prefer this over ad-hoc authenticatePortalBearer + resolvePortalArtist
 * so membership checks cannot be forgotten on write routes.
 */

import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import {
  portalWriteWithCanary,
  type PortalDb,
  type PortalWriteResult,
} from '@/lib/portal/portalWriteClient'
import type { Artist } from '@/types'
import type { Database } from '@/types/database'

export interface PortalMembershipContext {
  token: string
  user: User
  artist: Artist
  /** JWT-scoped client (auth.uid() set) — use for membership reads and canary user path */
  userDb: SupabaseClient<Database>
  /** Service-role client — canary default / privileged side effects */
  serviceDb: SupabaseClient<Database>
}

/**
 * Authenticate the portal Bearer token and resolve the active artist membership.
 * @throws ApiError 401/403
 */
export async function withPortalMembership(
  req: NextRequest,
  artistId?: string | null,
): Promise<PortalMembershipContext> {
  const { token, user, supabase: userDb } = await authenticatePortalBearer(req)

  let artist: Artist | null
  try {
    artist = await resolvePortalArtist(userDb, user.id, artistId ?? undefined)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) {
      throw new ApiError(403, 'No artist linked to this account')
    }
    throw err
  }
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const serviceDb = await createServiceRoleSupabaseClient()

  return {
    token,
    user,
    artist,
    userDb,
    serviceDb,
  }
}

/**
 * Membership-scoped write using the dual-path canary (see portalWriteClient).
 * Always call after withPortalMembership — never without membership.
 */
export async function portalMemberWrite<T>(
  ctx: PortalMembershipContext,
  meta: {
    route: string
    table: string
    operation: string
  },
  write: (db: PortalDb) => Promise<T>,
): Promise<PortalWriteResult<T>> {
  return portalWriteWithCanary({
    userDb: ctx.userDb,
    serviceDb: ctx.serviceDb,
    context: {
      route: meta.route,
      table: meta.table,
      operation: meta.operation,
      artistId: ctx.artist.id,
      userId: ctx.user.id,
    },
    write,
  })
}

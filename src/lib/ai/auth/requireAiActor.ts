import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { BudgetRole } from '@/lib/ai/budget/manager'

export type AiAccessContext = 'artist' | 'editor' | 'admin'

export interface AiActor {
  userId: string
  role: BudgetRole
  accessContext: AiAccessContext
  artistId: string | null
  serviceDb: SupabaseClient<Database>
  userDb: SupabaseClient<Database>
}

export async function requireAiActor(
  req: NextRequest,
  options?: { artistId?: string | null; requireArtist?: boolean },
): Promise<AiActor> {
  const { user, supabase: userDb } = await authenticatePortalBearer(req)
  const serviceDb = await createServiceRoleSupabaseClient()
  const rawRole = await getUserRoleWithClient(serviceDb, user.id)
  const role: BudgetRole | null =
    rawRole === 'admin' || rawRole === 'editor' || rawRole === 'artist' ? rawRole : null
  if (!role) {
    throw new ApiError(403, 'The AI assistant is only available to artists, editors, and admins.', 'FORBIDDEN')
  }

  const requireArtist = options?.requireArtist === true
  const requestedArtistId = options?.artistId?.trim() || ''

  if (role === 'artist' || requireArtist) {
    const artist = await resolvePortalArtist(userDb, user.id, requestedArtistId || undefined)
    if (!artist) throw new ApiError(403, 'No artist linked to this account', 'FORBIDDEN_NO_ARTIST')
    return {
      userId: user.id,
      role: role === 'admin' || role === 'editor' ? role : 'artist',
      accessContext: 'artist',
      artistId: artist.id,
      serviceDb,
      userDb,
    }
  }

  if (requestedArtistId) {
    const artist = await resolvePortalArtist(userDb, user.id, requestedArtistId).catch(() => null)
    return {
      userId: user.id,
      role,
      accessContext: role,
      artistId: artist?.id ?? null,
      serviceDb,
      userDb,
    }
  }

  return {
    userId: user.id,
    role,
    accessContext: role,
    artistId: null,
    serviceDb,
    userDb,
  }
}

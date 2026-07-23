/**
 * src/lib/portal/bearerAuth.ts
 *
 * Shared Bearer-token authentication for portal Route Handlers.
 * Uses createBearerAuthSupabaseClient so RLS sees auth.uid() correctly.
 */

import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import {
  createBearerAuthSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase/server'
import type { Artist } from '@/types'
import type { Database } from '@/types/database'

export interface PortalBearerAuth {
  token: string
  user: User
  supabase: SupabaseClient<Database>
}

export interface PortalBearerAuthWithArtist extends PortalBearerAuth {
  artist: Artist
}

export async function authenticatePortalBearer(req: NextRequest): Promise<PortalBearerAuth> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const supabase = await createBearerAuthSupabaseClient(token)
  return { token, user, supabase }
}

export async function authenticatePortalBearerWithArtist(
  req: NextRequest,
  artistId?: string | null,
  options?: { requireArtistId?: boolean },
): Promise<PortalBearerAuthWithArtist> {
  // Default false: read/list may omit artistId (first membership). Mutations pass true.
  const requireArtistId = options?.requireArtistId === true
  const trimmed = typeof artistId === 'string' ? artistId.trim() : ''
  if (requireArtistId && !trimmed) {
    throw new ApiError(400, 'artistId is required')
  }

  const auth = await authenticatePortalBearer(req)
  const artist = await resolvePortalArtist(
    auth.supabase,
    auth.user.id,
    trimmed || undefined,
  ).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')
  return { ...auth, artist }
}
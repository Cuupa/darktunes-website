import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { createRelease } from '@/lib/api/releases'

const bodySchema = z.object({
  title: z.string().min(1),
  releaseDate: z.string().min(1),
  type: z.enum(['album', 'ep', 'single']),
  coverArt: z.string().url().nullable().optional(),
  spotifyUrl: z.string().url().nullable().optional(),
  appleMusicUrl: z.string().url().nullable().optional(),
  youtubeUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const body = bodySchema.parse(await req.json())

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const release = await createRelease(supabase, {
    title: body.title,
    artist_id: artist.id,
    artist_name: artist.name,
    release_date: body.releaseDate,
    type: body.type,
    cover_art: body.coverArt ?? null,
    spotify_url: body.spotifyUrl ?? null,
    apple_music_url: body.appleMusicUrl ?? null,
    youtube_url: body.youtubeUrl ?? null,
    is_visible: false,
    featured: false,
  })

  const serviceRole = await createServiceRoleSupabaseClient()
  const { data: editorProfiles } = await serviceRole
    .from('profiles')
    .select('id')
    .eq('role', 'editor')

  const recipients = (editorProfiles ?? []).map((profile) => ({
    recipient_id: profile.id,
    type: 'artist_release_submission',
    entity_type: 'release',
    entity_id: release.id,
    entity_name: release.title,
    sender_id: user.id,
    read: false,
  }))

  if (recipients.length > 0) {
    await serviceRole.from('editor_notifications').insert(recipients)
  }

  return NextResponse.json({ releaseId: release.id })
})

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createReleaseSubmission } from '@/lib/api/releaseSubmissions'
import { getFormSchema } from '@/lib/api/submissionFormSchema'

const bodySchema = z.object({
  title: z.string().min(1),
  audioDownloadUrl: z.string().url(),
  coverArtUrl: z.string().url(),
  coverArtVerified: z.boolean().optional().default(false),
  releaseDate: z.string().nullable().optional(),
  type: z.enum(['album', 'ep', 'single']).nullable().optional(),
  genre: z.string().nullable().optional(),
  catalogNumber: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  labelCopy: z.string().nullable().optional(),
  spotifyUrl: z.string().url().nullable().optional(),
  appleMusicUrl: z.string().url().nullable().optional(),
  youtubeUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
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

  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  let artist
  try {
    artist = await resolvePortalArtist(supabase, user.id, artistId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  }
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  // Validate required fields from dynamic schema
  const schemaFields = await getFormSchema(supabase, 'release')
  for (const field of schemaFields) {
    if (!field.isRequired) continue
    const val = (body as Record<string, unknown>)[
      field.fieldKey === 'audio_download_url' ? 'audioDownloadUrl'
      : field.fieldKey === 'cover_art_url' ? 'coverArtUrl'
      : field.fieldKey === 'release_date' ? 'releaseDate'
      : field.fieldKey === 'catalog_number' ? 'catalogNumber'
      : field.fieldKey === 'label_copy' ? 'labelCopy'
      : field.fieldKey === 'apple_music_url' ? 'appleMusicUrl'
      : field.fieldKey === 'spotify_url' ? 'spotifyUrl'
      : field.fieldKey === 'youtube_url' ? 'youtubeUrl'
      : field.fieldKey
    ]
    if (val === undefined || val === null || val === '') {
      throw new ApiError(400, `Required field missing: ${field.fieldKey}`)
    }
  }

  const submission = await createReleaseSubmission(supabase, {
    artist_id: artist.id,
    title: body.title,
    audio_download_url: body.audioDownloadUrl,
    cover_art_url: body.coverArtUrl,
    cover_art_verified: body.coverArtVerified ?? false,
    release_date: body.releaseDate ?? null,
    type: body.type ?? null,
    genre: body.genre ?? null,
    catalog_number: body.catalogNumber ?? null,
    isrc: body.isrc ?? null,
    label_copy: body.labelCopy ?? null,
    spotify_url: body.spotifyUrl ?? null,
    apple_music_url: body.appleMusicUrl ?? null,
    youtube_url: body.youtubeUrl ?? null,
    notes: body.notes ?? null,
    form_data: body.formData ?? null,
  })

  // Notify editors
  const serviceRole = await createServiceRoleSupabaseClient()
  const { data: editorProfiles } = await serviceRole
    .from('profiles')
    .select('id')
    .eq('role', 'editor')

  const recipients = (editorProfiles ?? []).map((profile) => ({
    recipient_id: profile.id,
    type: 'artist_release_submission',
    entity_type: 'release_submission',
    entity_id: submission.id,
    entity_name: submission.title,
    sender_id: user.id,
    read: false,
  }))

  if (recipients.length > 0) {
    await serviceRole.from('editor_notifications').insert(recipients)
  }

  return NextResponse.json({ submissionId: submission.id })
})

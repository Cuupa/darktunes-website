import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createReleaseSubmission } from '@/lib/api/releaseSubmissions'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { checkAndClaimIdempotencyKey, updateIdempotencyKeyResourceId } from '@/lib/api/idempotency'
import { sendSubmissionNotificationEmail } from '@/lib/email/sendSubmissionNotificationEmail'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

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
  idempotencyKey: z.string().uuid().optional(),
})

/**
 * Maps snake_case DB field keys (from submission_form_schema) to their
 * camelCase counterparts in the validated request body.
 * Any field key NOT present in this map is a custom/dynamic field and must
 * be looked up inside body.formData instead.
 */
const STANDARD_FIELD_TO_BODY_KEY: Record<string, string> = {
  title: 'title',
  audio_download_url: 'audioDownloadUrl',
  cover_art_url: 'coverArtUrl',
  cover_art_verified: 'coverArtVerified',
  release_date: 'releaseDate',
  type: 'type',
  genre: 'genre',
  catalog_number: 'catalogNumber',
  isrc: 'isrc',
  label_copy: 'labelCopy',
  spotify_url: 'spotifyUrl',
  apple_music_url: 'appleMusicUrl',
  youtube_url: 'youtubeUrl',
  notes: 'notes',
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const body = bodySchema.parse(await req.json())

  const serviceRole = await createServiceRoleSupabaseClient()
  if (body.idempotencyKey) {
    const claimed = await checkAndClaimIdempotencyKey(
      serviceRole,
      body.idempotencyKey,
      'submit-release',
    )
    if (!claimed) {
      throw new ApiError(409, 'Duplicate request: this submission was already processed')
    }
  }

  const schemaFields = await getFormSchema(supabase, 'release')
  for (const field of schemaFields) {
    if (!field.isRequired) continue
    const bodyKey = STANDARD_FIELD_TO_BODY_KEY[field.fieldKey]
    const val = bodyKey !== undefined
      ? (body as Record<string, unknown>)[bodyKey]
      : (body.formData ?? {})[field.fieldKey]
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

  const { data: recipientProfiles } = await serviceRole
    .from('users')
    .select('id')
    .in('role', ['admin', 'editor'])

  const recipients = (recipientProfiles ?? []).map((profile) => ({
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

  const resendApiKey = process.env.RESEND_API_KEY ?? ''
  const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? ''
  const labelNotificationEmail = process.env.LABEL_NOTIFICATION_EMAIL ?? ''
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(/\/$/, '')
  void sendSubmissionNotificationEmail(
    {
      type: 'release',
      title: submission.title,
      artistName: artist.name,
      submittedAt: new Date().toISOString(),
      adminUrl: `${siteUrl}/admin`,
    },
    { resendApiKey, resendFromEmail, labelNotificationEmail, fetch },
  ).catch((err: unknown) =>
    console.error('[submit-release] Email notification error:', err instanceof Error ? err.message : err),
  )

  if (body.idempotencyKey) {
    void updateIdempotencyKeyResourceId(serviceRole, body.idempotencyKey, submission.id)
  }

  return NextResponse.json({ submissionId: submission.id })
})
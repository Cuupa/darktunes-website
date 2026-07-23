import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createReleaseSubmission } from '@/lib/api/releaseSubmissions'
import { createReleaseSubmissionTracks } from '@/lib/api/releaseSubmissionTracks'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { getReleaseTypeRules } from '@/lib/api/submissionReleaseTypeRules'
import {
  checkAndClaimIdempotencyKey,
  getIdempotencyKeyRecord,
  updateIdempotencyKeyResourceId,
} from '@/lib/api/idempotency'
import { sendSubmissionNotificationEmail } from '@/lib/email/sendSubmissionNotificationEmail'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { buildTrackInsert, filterArtistTrackFields } from '@/lib/submissions/trackFieldMapping'
import { coerceReleaseDate } from '@/lib/submissions/submissionSchemaValidation'
import { filterFieldsForType } from '@/lib/submissions/fieldTypeRules'
import { validateReleaseSubmissionByType } from '@/lib/submissions/submissionTypeValidation'
import { verifyCoverArtUrl } from '@/lib/submissions/coverArtCheck'
import { verifyCoverArtToken } from '@/lib/submissions/coverArtToken'
import type { SubmissionFieldType } from '@/lib/submissions/fieldTypes'

const trackInputSchema = z.object({
  trackNumber: z.number().int().min(1),
  values: z.record(z.string(), z.string()),
})

/** Empty string → null so optional URL fields do not fail z.string().url(). */
const optionalUrl = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().url().nullable().optional(),
)

const bodySchema = z.object({
  title: z.string().min(1),
  audioDownloadUrl: z.string().url(),
  coverArtUrl: z.string().url(),
  coverArtVerified: z.boolean().optional().default(false),
  coverArtCheckToken: z.string().min(1).optional(),
  releaseDate: z.string().nullable().optional(),
  type: z.enum(['album', 'ep', 'single', 'compilation']).nullable().optional(),
  genre: z.string().nullable().optional(),
  catalogNumber: z.string().nullable().optional(),
  isrc: z.string().nullable().optional(),
  labelCopy: z.string().nullable().optional(),
  spotifyUrl: optionalUrl,
  appleMusicUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  notes: z.string().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
  tracks: z.array(trackInputSchema).optional(),
  trackCount: z.number().int().min(1).optional(),
  idempotencyKey: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const body = bodySchema.parse(await req.json())
  const formData = (body.formData ?? {}) as Record<string, unknown>

  const serviceRole = await createServiceRoleSupabaseClient()
  const claimed = await checkAndClaimIdempotencyKey(
    serviceRole,
    body.idempotencyKey,
    'submit-release',
  )
  if (!claimed) {
    const existing = await getIdempotencyKeyRecord(serviceRole, body.idempotencyKey)
    if (existing?.resourceId) {
      return NextResponse.json({ submissionId: existing.resourceId, duplicate: true })
    }
    throw new ApiError(409, 'Duplicate request: this submission was already processed')
  }

  const [schemaFields, typeRules] = await Promise.all([
    getFormSchema(supabase, 'release'),
    getReleaseTypeRules(supabase),
  ])

  const standardBody: Record<string, unknown> = { ...body, releaseDate: coerceReleaseDate(body.releaseDate) }
  const tracks = body.tracks ?? []

  validateReleaseSubmissionByType({
    releaseType: body.type,
    trackCount: body.trackCount,
    tracks,
    schemaFields,
    typeRules,
    standardBody,
    formData,
  })

  // Cover integrity: accept short-lived signed token, else re-verify server-side
  const coverFieldInSchema = schemaFields.some(
    (f) => f.fieldKey === 'cover_art_url' && f.fieldScope === 'release' && f.isVisible,
  )
  if (coverFieldInSchema || body.coverArtUrl) {
    const { serverEnv } = await import('@/lib/env.server')
    let coverOk = false
    if (body.coverArtCheckToken) {
      const tokenResult = verifyCoverArtToken(
        serverEnv.API_CREDENTIALS_ENCRYPTION_KEY,
        body.coverArtCheckToken,
        body.coverArtUrl,
      )
      coverOk = tokenResult.ok
    }
    if (!coverOk) {
      const coverCheck = await verifyCoverArtUrl(body.coverArtUrl, {
        r2PublicUrl: serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
      })
      if (!coverCheck.verified) {
        throw new ApiError(
          400,
          coverCheck.message ??
            `Cover art verification failed (${coverCheck.code}). Expected JPEG 3000×3000.`,
        )
      }
    }
  }

  const releaseType = body.type ?? 'single'
  const trackFields = filterArtistTrackFields(
    filterFieldsForType(
      schemaFields.filter((f) => f.fieldScope === 'track'),
      releaseType,
      { type: releaseType },
    ),
  )

  const submission = await createReleaseSubmission(supabase, {
    artist_id: artist.id,
    title: body.title,
    audio_download_url: body.audioDownloadUrl,
    cover_art_url: body.coverArtUrl,
    cover_art_verified: true,
    release_date: coerceReleaseDate(body.releaseDate),
    type: body.type ?? null,
    genre: body.genre ?? null,
    catalog_number: body.catalogNumber ?? null,
    isrc: body.isrc ?? null,
    label_copy: body.labelCopy ?? null,
    spotify_url: body.spotifyUrl ?? null,
    apple_music_url: body.appleMusicUrl ?? null,
    youtube_url: body.youtubeUrl ?? null,
    notes: body.notes ?? null,
    form_data: Object.keys(formData).length > 0 ? formData : null,
  })

  if (tracks.length > 0) {
    const inserts = tracks.map((track, index) => {
      const fieldValues: Record<string, { value: string; fieldType: SubmissionFieldType }> = {}
      for (const field of trackFields) {
        fieldValues[field.fieldKey] = {
          value: track.values[field.fieldKey] ?? '',
          fieldType: field.fieldType,
        }
      }
      return buildTrackInsert(submission.id, track.trackNumber, index, fieldValues)
    })
    await createReleaseSubmissionTracks(supabase, inserts)
  }

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

  const { resendApiKey: storedResendKey, resendFromEmail: storedFromEmail } =
    await getEmailCredentials(serviceRole)
  const resendApiKey = storedResendKey ?? ''
  const resendFromEmail = storedFromEmail ?? ''
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

  void updateIdempotencyKeyResourceId(serviceRole, body.idempotencyKey, submission.id)

  return NextResponse.json({ submissionId: submission.id })
})
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import {
  attachAssetsToSubmission,
  getReleaseSubmissionAssetByKey,
} from '@/lib/api/releaseSubmissionAssets'
import {
  createReleaseSubmissionWithTracksAtomic,
  getReleaseSubmissionById,
  replaceRejectedSubmissionTracks,
} from '@/lib/api/releaseSubmissions'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { getReleaseTypeRules } from '@/lib/api/submissionReleaseTypeRules'
import {
  checkAndClaimIdempotencyKey,
  getIdempotencyKeyRecord,
  releaseIdempotencyKey,
  updateIdempotencyKeyResourceId,
} from '@/lib/api/idempotency'
import { sendSubmissionNotificationEmail } from '@/lib/email/sendSubmissionNotificationEmail'
import { withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'
import { buildTrackInsert, filterArtistTrackFields } from '@/lib/submissions/trackFieldMapping'
import { coerceReleaseDate } from '@/lib/submissions/submissionSchemaValidation'
import { filterFieldsForType } from '@/lib/submissions/fieldTypeRules'
import { validateReleaseSubmissionByType } from '@/lib/submissions/submissionTypeValidation'
import { verifyCoverArtUrl } from '@/lib/submissions/coverArtCheck'
import { verifyCoverArtToken } from '@/lib/submissions/coverArtToken'
import {
  assetsExpireAt,
  isOwnedReleaseSubmissionKey,
  r2CoverTokenUrl,
} from '@/lib/submissions/submissionAssets'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { createR2Client } from '@/lib/r2Utils'
import type { SubmissionFieldType } from '@/lib/submissions/fieldTypes'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { emitNotification } from '@/lib/notifications/emit'

const trackInputSchema = z.object({
  trackNumber: z.number().int().min(1),
  values: z.record(z.string(), z.string()),
})

/** Empty string → null so optional URL fields do not fail z.string().url(). */
const optionalUrl = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().url().nullable().optional(),
)

const bodySchema = z
  .object({
    title: z.string().min(1),
    audioDownloadUrl: optionalUrl,
    coverArtUrl: optionalUrl,
    audioR2Key: z.string().min(1).max(512).optional(),
    coverR2Key: z.string().min(1).max(512).optional(),
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
    submissionId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.audioR2Key || value.audioDownloadUrl), {
    message: 'Audio file is required',
  })
  .refine((value) => Boolean(value.coverR2Key || value.coverArtUrl), {
    message: 'Cover art is required',
  })

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { user, artist, serviceDb: serviceRole, userDb: supabase } = ctx

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(`submit-release:${user.id}:${ip}`, 20, 10 * 60_000)
  if (rl.limited) {
    throw new ApiError(429, 'Too many release submissions. Please wait and try again.')
  }

  const body = bodySchema.parse(await req.json())
  const formData = (body.formData ?? {}) as Record<string, unknown>

  // Idempotency keys — service role forever (system table)
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

  try {
    const [schemaFields, typeRules] = await Promise.all([
      getFormSchema(supabase, 'release'),
      getReleaseTypeRules(supabase),
    ])

    // Keep raw releaseDate for schema validation (date_dmy expects DD/MM/YYYY).
    // Coerce to ISO only when writing to the DB below.
    const standardBody: Record<string, unknown> = { ...body }
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

    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )

    const assertOwnedAsset = async (key: string, kind: 'audio' | 'cover') => {
      if (!isOwnedReleaseSubmissionKey(key, artist.id)) {
        throw new ApiError(403, `The ${kind} file does not belong to this artist. Upload it again.`)
      }
      const asset = await getReleaseSubmissionAssetByKey(serviceRole, key)
      if (!asset || asset.artistId !== artist.id || asset.kind !== kind) {
        throw new ApiError(404, `The ${kind} file was not found. Upload it again.`)
      }
      try {
        await s3.send(
          new HeadObjectCommand({ Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME, Key: key }),
        )
      } catch {
        throw new ApiError(400, `The ${kind} file is missing in storage. Upload it again.`)
      }
    }

    if (body.audioR2Key) await assertOwnedAsset(body.audioR2Key, 'audio')
    if (body.coverR2Key) await assertOwnedAsset(body.coverR2Key, 'cover')

    const coverTokenUrl = body.coverR2Key
      ? r2CoverTokenUrl(body.coverR2Key)
      : (body.coverArtUrl ?? '')
    const coverFieldInSchema = schemaFields.some(
      (f) => f.fieldKey === 'cover_art_url' && f.fieldScope === 'release' && f.isVisible,
    )
    if (coverFieldInSchema || coverTokenUrl) {
      let coverOk = false
      if (body.coverArtCheckToken && coverTokenUrl) {
        const tokenResult = verifyCoverArtToken(
          serverEnv.API_CREDENTIALS_ENCRYPTION_KEY,
          body.coverArtCheckToken,
          coverTokenUrl,
        )
        coverOk = tokenResult.ok
      }
      if (!coverOk && body.coverArtUrl && !body.coverR2Key) {
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
      } else if (!coverOk && body.coverR2Key) {
        throw new ApiError(
          400,
          'Cover art is not verified. Upload a JPEG at 3000×3000 px and run the cover check.',
        )
      }
    }

    let existingId: string | null = null
    if (body.submissionId) {
      const existing = await getReleaseSubmissionById(serviceRole, body.submissionId)
      if (!existing || existing.artistId !== artist.id) {
        throw new ApiError(404, 'That submission was not found. Open it from your submissions list.')
      }
      if (existing.status !== 'rejected') {
        throw new ApiError(
          409,
          'Only a rejected submission can be edited. Submit a new release instead.',
        )
      }
      existingId = existing.id
    }

    const releaseType = body.type ?? 'single'
    const trackFields = filterArtistTrackFields(
      filterFieldsForType(
        schemaFields.filter((f) => f.fieldScope === 'track'),
        releaseType,
        { type: releaseType },
      ),
    )

    const trackInserts = tracks.map((track, index) => {
      const fieldValues: Record<string, { value: string; fieldType: SubmissionFieldType }> = {}
      for (const field of trackFields) {
        fieldValues[field.fieldKey] = {
          value: track.values[field.fieldKey] ?? '',
          fieldType: field.fieldType,
        }
      }
      return buildTrackInsert(
        // RPC assigns submission_id inside the transaction
        null,
        track.trackNumber,
        index,
        fieldValues,
      )
    })

    const expireAt = assetsExpireAt()
    const payload = {
      artist_id: artist.id,
      title: body.title,
      audio_download_url: body.audioDownloadUrl ?? '',
      cover_art_url: body.coverArtUrl ?? '',
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
      audio_r2_key: body.audioR2Key ?? null,
      cover_r2_key: body.coverR2Key ?? null,
      assets_expire_at: body.audioR2Key || body.coverR2Key ? expireAt : null,
    }

    const submission = existingId
      ? await replaceRejectedSubmissionTracks(serviceRole, existingId, payload, trackInserts)
      : await createReleaseSubmissionWithTracksAtomic(serviceRole, payload, trackInserts)

    const assetKeys = [body.audioR2Key, body.coverR2Key].filter((key): key is string => Boolean(key))
    await attachAssetsToSubmission(serviceRole, artist.id, submission.id, assetKeys, expireAt)

    await emitNotification(serviceRole, {
      type: 'artist_release_submission',
      entityId: submission.id,
      entityName: submission.title,
      senderId: user.id,
      artistId: artist.id,
      dedupeKey: `artist_release_submission:${submission.id}`,
    })

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
      console.error(
        '[submit-release] Email notification error:',
        err instanceof Error ? err.message : err,
      ),
    )

    await updateIdempotencyKeyResourceId(serviceRole, body.idempotencyKey, submission.id)

    return NextResponse.json({ submissionId: submission.id })
  } catch (err) {
    // Allow client retry with the same key after validation / transient failures
    await releaseIdempotencyKey(serviceRole, body.idempotencyKey)
    throw err
  }
})
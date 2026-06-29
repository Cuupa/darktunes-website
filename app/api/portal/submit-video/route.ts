import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { createVideoSubmission } from '@/lib/api/videoSubmissions'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { sendSubmissionNotificationEmail } from '@/lib/email/sendSubmissionNotificationEmail'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

const bodySchema = z.object({
  title: z.string().min(1),
  downloadUrl: z.string().url(),
  description: z.string().nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  youtubeTitle: z.string().nullable().optional(),
  youtubeDescription: z.string().nullable().optional(),
  youtubeTags: z.array(z.string()).optional().default([]),
  youtubeCategory: z.string().nullable().optional(),
  targetPublishDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
})

const STANDARD_FIELD_TO_BODY_KEY: Record<string, string> = {
  title: 'title',
  download_url: 'downloadUrl',
  thumbnail_url: 'thumbnailUrl',
  youtube_title: 'youtubeTitle',
  youtube_description: 'youtubeDescription',
  youtube_tags: 'youtubeTags',
  youtube_category: 'youtubeCategory',
  target_publish_date: 'targetPublishDate',
  description: 'description',
  notes: 'notes',
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  const { supabase, user, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const body = bodySchema.parse(await req.json())

  const schemaFields = await getFormSchema(supabase, 'video')
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

  const submission = await createVideoSubmission(supabase, {
    artist_id: artist.id,
    title: body.title,
    download_url: body.downloadUrl,
    description: body.description ?? null,
    thumbnail_url: body.thumbnailUrl ?? null,
    youtube_title: body.youtubeTitle ?? null,
    youtube_description: body.youtubeDescription ?? null,
    youtube_tags: body.youtubeTags,
    youtube_category: body.youtubeCategory ?? null,
    target_publish_date: body.targetPublishDate ?? null,
    notes: body.notes ?? null,
    form_data: body.formData ?? null,
  })

  const serviceRole = await createServiceRoleSupabaseClient()
  const { data: recipientProfiles } = await serviceRole
    .from('users')
    .select('id')
    .in('role', ['admin', 'editor'])

  const recipients = (recipientProfiles ?? []).map((profile) => ({
    recipient_id: profile.id,
    type: 'artist_video_submission',
    entity_type: 'video_submission',
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
      type: 'video',
      title: submission.title,
      artistName: artist.name,
      submittedAt: new Date().toISOString(),
      adminUrl: `${siteUrl}/admin`,
    },
    { resendApiKey, resendFromEmail, labelNotificationEmail, fetch },
  ).catch((err: unknown) =>
    console.error('[submit-video] Email notification error:', err instanceof Error ? err.message : err),
  )

  return NextResponse.json({ submissionId: submission.id })
})
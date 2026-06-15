import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createVideoSubmission } from '@/lib/api/videoSubmissions'
import { sendSubmissionNotificationEmail } from '@/lib/email/sendSubmissionNotificationEmail'

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
  })

  // Notify editors and admins
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

  // Send label notification email (fire-and-forget; failure does not block the response)
  const resendApiKey = process.env.RESEND_API_KEY ?? ''
  const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? ''
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

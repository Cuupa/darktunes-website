/**
 * POST — Fan Page publish workflow (draft / review / direct)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getFanPageDocumentState, publishFanPage } from '@/lib/api/fanPageDocument'
import { validateFanPageForPublish, canHardPublish } from '@/lib/fan-page/publishValidation'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
  mode: z.enum(['draft', 'submit_review', 'publish_direct']),
  force: z.boolean().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const body = bodySchema.parse(await req.json())

  const artist = await resolvePortalArtist(supabase, user.id, body.artist_id).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const state = await getFanPageDocumentState(supabase, artist.id, artist, null)
  const warnings = validateFanPageForPublish(state.document)

  if (
    (body.mode === 'submit_review' || body.mode === 'publish_direct') &&
    !canHardPublish(warnings) &&
    !body.force
  ) {
    return NextResponse.json({ error: 'validation_failed', warnings }, { status: 422 })
  }

  if (body.mode === 'publish_direct' && !artist.landingPublishTrusted) {
    throw new ApiError(403, 'Direct publish not allowed for this artist')
  }

  // Membership verified — publish state writes use service-role so band members
  // are not blocked by legacy RLS on artist_landing_pages.
  const serviceRole = await createServiceRoleSupabaseClient()
  const result = await publishFanPage(serviceRole, {
    artistId: artist.id,
    mode: body.mode,
    landingPublishTrusted: artist.landingPublishTrusted ?? false,
    userId: user.id,
  })

  if (body.mode === 'submit_review') {
    const { data: recipients } = await serviceRole
      .from('users')
      .select('id')
      .in('role', ['admin', 'editor'])

    if (recipients?.length) {
      await serviceRole.from('editor_notifications').insert(
        recipients.map((r) => ({
          recipient_id: r.id,
          type: 'landing_page_review',
          entity_type: 'artist',
          entity_id: artist.id,
          entity_name: `${artist.name} Fan Page`,
          sender_id: user.id,
          read: false,
        })),
      )
    }
  }

  if (result.publishStatus === 'published') {
    revalidateTag(`fan-page-${artist.slug}`, 'max')
  }

  return NextResponse.json({ ...result, warnings })
})
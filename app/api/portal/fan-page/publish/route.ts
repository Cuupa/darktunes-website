/**
 * POST — Fan Page publish workflow (draft / review / direct)
 *
 * Membership via withPortalMembershipWrite; publish write via portalMemberWrite.
 * editor_notifications stay service-role forever (staff-only table).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getFanPageDocumentState, publishFanPage } from '@/lib/api/fanPageDocument'
import { validateFanPageForPublish, canHardPublish } from '@/lib/fan-page/publishValidation'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { revalidateTag } from 'next/cache'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
  mode: z.enum(['draft', 'submit_review', 'publish_direct']),
  force: z.boolean().optional(),
})

const ROUTE = 'POST /api/portal/fan-page/publish'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json())
  const ctx = await withPortalMembershipWrite(req, body.artist_id)
  const { artist, user, serviceDb } = ctx

  // Read path: canary-aware (same membership-scoped client policy as writes)
  const { value: state } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_landing_pages', operation: 'select' },
    (db) => getFanPageDocumentState(db, artist.id, artist, null),
  )
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

  const { value: result } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_landing_pages', operation: 'update' },
    (db) =>
      publishFanPage(db, {
        artistId: artist.id,
        mode: body.mode,
        landingPublishTrusted: artist.landingPublishTrusted ?? false,
        userId: user.id,
      }),
  )

  // Staff notifications — always service role (artists have no INSERT on editor_notifications)
  if (body.mode === 'submit_review') {
    const { data: recipients } = await serviceDb
      .from('users')
      .select('id')
      .in('role', ['admin', 'editor'])

    if (recipients?.length) {
      await serviceDb.from('editor_notifications').insert(
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

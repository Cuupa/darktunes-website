/**
 * app/api/portal/checklist/route.ts
 *
 * PATCH /api/portal/checklist — toggle a release checklist item.
 * Loads artist_id from the checklist row, then membership-pins via helper.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { toggleChecklistItem } from '@/lib/api/releaseChecklists'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  checklistId: z.string().uuid(),
  isCompleted: z.boolean(),
  /** Optional; when omitted, resolved from the checklist row. */
  artistId: z.string().uuid().optional(),
})

const ROUTE = 'PATCH /api/portal/checklist'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json())

  let artistId = body.artistId
  if (!artistId) {
    const serviceDb = await createServiceRoleSupabaseClient()
    const { data: row, error } = await serviceDb
      .from('release_checklists')
      .select('artist_id')
      .eq('id', body.checklistId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) throw new ApiError(404, 'Checklist item not found')
    artistId = row.artist_id
  }

  const ctx = await withPortalMembershipWrite(req, artistId)
  const { value: result } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'release_checklists', operation: 'update' },
    (db) => toggleChecklistItem(db, body.checklistId, body.isCompleted),
  )

  // Ensure the row belongs to the pinned artist (defense in depth)
  if (result.artistId !== ctx.artist.id) {
    throw new ApiError(403, 'Not authorized for this checklist item')
  }

  return NextResponse.json(result)
})

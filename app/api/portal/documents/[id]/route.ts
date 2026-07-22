/**
 * app/api/portal/documents/[id]/route.ts
 *
 * DELETE — remove a document (DB row + R2 object)
 *
 * Membership is verified with the bearer client; DB deletes use service-role.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getArtistDocument, deleteArtistDocument } from '@/lib/api/artistDocuments'
import { createR2Client } from '@/lib/r2Utils'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)

  const artistId = req.nextUrl.searchParams.get('artistId')
  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) throw new ApiError(400, 'Missing document id')

  const serviceDb = await createServiceRoleSupabaseClient()
  const doc = await getArtistDocument(serviceDb, id, artist.id)
  if (!doc) throw new ApiError(404, 'Document not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  await s3.send(
    new DeleteObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: doc.filePath,
    }),
  )

  await deleteArtistDocument(serviceDb, id, artist.id)

  return NextResponse.json({ success: true })
})

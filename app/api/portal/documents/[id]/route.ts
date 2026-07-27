/**
 * app/api/portal/documents/[id]/route.ts
 *
 * DELETE — remove a document (DB row + R2 object)
 *
 * Membership via withPortalMembershipWrite; DB delete via portalMemberWrite.
 * R2 delete always uses env credentials (not RLS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getArtistDocument, deleteArtistDocument } from '@/lib/api/artistDocuments'
import { createR2Client } from '@/lib/r2Utils'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const ROUTE = 'DELETE /api/portal/documents/[id]'

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const ctx = await withPortalMembershipWrite(req, artistId)
  const { artist } = ctx

  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) throw new ApiError(400, 'Missing document id')

  const { value: doc } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_documents', operation: 'select' },
    (db) => getArtistDocument(db, id, artist.id),
  )
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

  await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_documents', operation: 'delete' },
    (db) => deleteArtistDocument(db, id, artist.id),
  )

  return NextResponse.json({ success: true })
})

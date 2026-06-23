/**
 * app/api/portal/documents/[id]/download/route.ts
 *
 * GET — generate a short-lived (10 min) presigned download URL for a private document.
 * Verifies artist ownership before generating the URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getArtistDocument } from '@/lib/api/artistDocuments'
import { createR2Client } from '@/lib/r2Utils'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

const EXPIRY_SECONDS = 600 // 10 minutes

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const parts = req.nextUrl.pathname.split('/')
  const id = parts[parts.length - 2]
  if (!id) throw new ApiError(400, 'Missing document id')

  const doc = await getArtistDocument(supabase, id, artist.id)
  if (!doc) throw new ApiError(404, 'Document not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3Client = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const command = new GetObjectCommand({
    Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    Key: doc.filePath,
  })
  const url = await getSignedUrl(s3Client, command, { expiresIn: EXPIRY_SECONDS })

  return NextResponse.json({ url })
})
/**
 * app/api/portal/documents/[id]/download/route.ts
 *
 * GET — generate a short-lived (10 min) presigned download URL for a private document.
 * Verifies artist ownership before generating the URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getArtistDocument } from '@/lib/api/artistDocuments'
import { createR2Client } from '@/lib/r2Utils'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const EXPIRY_SECONDS = 600 // 10 minutes

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  // Extract id from URL: /api/portal/documents/{id}/download
  const parts = req.nextUrl.pathname.split('/')
  const id = parts[parts.length - 2] // second-to-last segment before "download"
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


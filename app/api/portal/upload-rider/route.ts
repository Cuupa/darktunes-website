/**
 * app/api/portal/upload-rider/route.ts
 *
 * Secure PDF upload endpoint for Artist Portal rider documents
 * (Stage Plot, Technical Rider, Hospitality Rider).
 *
 * Flow:
 *   1. Verify the Bearer token via Supabase Auth
 *   2. Confirm the artist_id belongs to the authenticated user
 *   3. Validate the uploaded file is a PDF ≤ 10 MB
 *   4. Upload to Cloudflare R2 under `riders/{artistId}/{type}/`
 *   5. Return the public CDN URL
 *
 * Query param: `type` — one of "stage_plot" | "technical" | "hospitality"
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createR2Client } from '@/lib/r2Utils'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

const ALLOWED_RIDER_TYPES = new Set(['stage_plot', 'technical', 'hospitality'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

async function uploadPdfToR2(
  file: File,
  artistId: string,
  riderType: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<string> {
  const key = `riders/${artistId}/${riderType}/${randomUUID()}.pdf`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `${r2PublicUrl.replace(/\/$/, '')}/${key}`
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)

  const artistId = req.nextUrl.searchParams.get('artistId')
  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const riderType = req.nextUrl.searchParams.get('type') ?? ''
  if (!ALLOWED_RIDER_TYPES.has(riderType)) {
    throw new ApiError(400, 'Invalid rider type. Must be stage_plot, technical, or hospitality')
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  if (file.size > MAX_BYTES) throw new ApiError(413, 'File too large (max 10 MB)')

  const isPdf =
    file.type === 'application/pdf' ||
    file.type === 'application/octet-stream' ||
    file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    throw new ApiError(415, 'Only PDF files are allowed')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const url = await uploadPdfToR2(
    file,
    artist.id,
    riderType,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  return NextResponse.json({ url })
})
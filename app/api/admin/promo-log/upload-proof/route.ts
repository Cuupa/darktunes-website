/**
 * app/api/admin/promo-log/upload-proof/route.ts
 *
 * POST /api/admin/promo-log/upload-proof
 * Content-Type: multipart/form-data  |  body: { file: File }
 * Auth: ******  (admin or editor role required)
 *
 * Uploads a screenshot/proof image to Cloudflare R2 and returns the public
 * URL and R2 key so the admin form can store them when saving the entry.
 * Accepts images only (JPEG, PNG, WebP, GIF).
 *
 * Returns: { url: string; r2Key: string }
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createR2Client } from '@/lib/r2Utils'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_PROOF_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function extFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'jpg'
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  const formData = await req.formData()
  const file = formData.get('file')
  const artistId = formData.get('artistId')

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')
  if (typeof artistId !== 'string' || !artistId) throw new ApiError(400, 'Missing artistId')

  if (file.size > MAX_PROOF_SIZE_BYTES) throw new ApiError(413, 'File too large (max 10 MB)')

  const contentType = file.type || 'image/jpeg'
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    throw new ApiError(415, 'Unsupported file type. Allowed: JPEG, PNG, WebP, GIF')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const ext = extFromMimeType(contentType)
  const r2Key = `promo-proofs/${artistId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const url = `${serverEnv.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`
  return NextResponse.json({ url, r2Key })
})

/**
 * app/api/upload/route.ts — File upload Route Handler
 *
 * Securely handles file uploads to Cloudflare R2 entirely server-side,
 * preventing CORS policy issues that would occur with direct client uploads.
 *
 * Security:
 *   1. Bearer token verified via Supabase — user must be authenticated.
 *   2. Admin or editor role is required (prevents arbitrary authenticated users
 *      from storing files in the label's R2 bucket).
 *   3. R2 credentials are loaded from validated server env (src/lib/env.server.ts).
 *   4. All errors are handled uniformly via withErrorHandler.
 *
 * Replaces the legacy api/upload.ts Vercel serverless function.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { extname } from 'path'
import { eventBus } from '@/domain/events/eventBus'
import { createAssetRecord, getAssetByHash } from '@/lib/api/assets'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(request.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new ApiError(400, 'Failed to parse form data')
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new ApiError(400, 'No file found in request')
  }

  const folderId = (formData.get('folderId') as string | null) || null
  const artistId = (formData.get('artistId') as string | null) || null
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'
  const sha256Hash = createHash('sha256').update(buffer).digest('hex')
  const supabase = await createServerSupabaseClient()

  const existingAsset = await getAssetByHash(supabase, sha256Hash)
  if (existingAsset) {
    return NextResponse.json({
      duplicate: true,
      asset: existingAsset,
      publicUrl: existingAsset.publicUrl,
      r2Key: existingAsset.r2Key,
      filename: existingAsset.filename,
      mimeType: existingAsset.mimeType,
      sizeBytes: existingAsset.sizeBytes,
    })
  }

  const ext = extname(file.name) || ''
  const r2Key = `uploads/${randomUUID()}${ext}`
  const { serverEnv } = await import('@/lib/env.server')
  const r2 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  await r2.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const publicUrl = `${serverEnv.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`
  const filename = r2Key.split('/').pop() ?? r2Key
  const asset = await createAssetRecord(supabase, {
    filename,
    original_filename: file.name,
    mime_type: mimeType,
    size_bytes: buffer.length,
    r2_key: r2Key,
    public_url: publicUrl,
    uploaded_by: userId,
    folder_id: folderId,
    artist_id: artistId,
    tags: [],
    sha256_hash: sha256Hash,
  })

  eventBus.emit({ type: 'asset.uploaded', r2Key, publicUrl, mimeType, sizeBytes: buffer.length })

  return NextResponse.json({
    duplicate: false,
    asset,
    publicUrl,
    r2Key,
    filename,
    mimeType,
    sizeBytes: buffer.length,
  })
})

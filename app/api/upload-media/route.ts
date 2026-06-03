/**
 * app/api/upload-media/route.ts — Media file upload Route Handler
 *
 * Dedicated upload endpoint for the Press & Media filesystem.
 * Files are stored in R2 and recorded in the media_files table,
 * completely separate from the assets table used by the Assets tab.
 */

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { createHash, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { extname } from 'path'
import { createMediaFileRecord, getMediaFileByHash } from '@/lib/api/mediaFiles'
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
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || 'application/octet-stream'
  const sha256Hash = createHash('sha256').update(buffer).digest('hex')
  const supabase = await createServerSupabaseClient()

  const existingFile = await getMediaFileByHash(supabase, sha256Hash)
  if (existingFile) {
    return NextResponse.json({
      duplicate: true,
      asset: existingFile,
      publicUrl: existingFile.publicUrl,
      r2Key: existingFile.r2Key,
      filename: existingFile.filename,
      mimeType: existingFile.mimeType,
      sizeBytes: existingFile.sizeBytes,
    })
  }

  const ext = extname(file.name) || ''
  const r2Key = `media/${randomUUID()}${ext}`
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
  const mediaFile = await createMediaFileRecord(supabase, {
    filename,
    original_filename: file.name,
    mime_type: mimeType,
    size_bytes: buffer.length,
    r2_key: r2Key,
    public_url: publicUrl,
    uploaded_by: userId,
    folder_id: folderId,
    tags: [],
    sha256_hash: sha256Hash,
  })

  return NextResponse.json({
    duplicate: false,
    asset: mediaFile,
    publicUrl,
    r2Key,
    filename,
    mimeType,
    sizeBytes: buffer.length,
  })
})

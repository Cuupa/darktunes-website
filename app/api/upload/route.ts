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

import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createR2Client } from '@/lib/r2Utils'
import { eventBus } from '@/domain/events/eventBus'

export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse> => {
  // 1. Authenticate — admin or editor role required
  const token = extractBearerToken(request.headers.get('authorization'))
  await verifyAdminOrEditor(token)

  // 2. Parse multipart form data
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

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extname(file.name) || ''
  const r2Key = `uploads/${randomUUID()}${ext}`

  // 3. Upload to R2 (dynamic import defers env validation to request time,
  //    so dev servers without R2 credentials don't fail at cold start)
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
      ContentType: file.type,
      ContentLength: buffer.length,
    }),
  )

  const publicUrl = `${serverEnv.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`

  eventBus.emit({ type: 'asset.uploaded', r2Key, publicUrl, mimeType: file.type, sizeBytes: buffer.length })

  return NextResponse.json({
    publicUrl,
    r2Key,
    filename: r2Key.split('/').pop() ?? r2Key,
    mimeType: file.type,
    sizeBytes: buffer.length,
  })
})

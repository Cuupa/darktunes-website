/**
 * app/api/upload/route.ts — File upload Route Handler
 *
 * Securely handles file uploads to Cloudflare R2 entirely server-side,
 * preventing CORS policy issues that would occur with direct client uploads.
 *
 * Security:
 *   1. Verifies Bearer token via Supabase service-role key
 *   2. Validates R2 configuration before attempting upload
 *   3. Returns the public CDN URL on success
 *
 * Replaces the legacy api/upload.ts Vercel serverless function.
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { extname } from 'path'

// ---------------------------------------------------------------------------
// R2 client factory
// ---------------------------------------------------------------------------

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function verifyToken(token: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase service key not configured')
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return data.user.id
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify bearer token
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 },
    )
  }
  const token = authHeader.slice(7)

  try {
    await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate R2 configuration
  const { CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_PUBLIC_URL } = process.env
  if (!CLOUDFLARE_R2_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY || !CLOUDFLARE_R2_BUCKET_NAME) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 500 })
  }

  // 3. Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file found in request' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extname(file.name) || ''
  const r2Key = `uploads/${randomUUID()}${ext}`

  // 4. Upload to R2
  try {
    const r2 = getR2Client()
    await r2.send(
      new PutObjectCommand({
        Bucket: CLOUDFLARE_R2_BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      }),
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload to R2 failed' },
      { status: 500 },
    )
  }

  const publicUrl = `${(CLOUDFLARE_R2_PUBLIC_URL ?? '').replace(/\/$/, '')}/${r2Key}`

  return NextResponse.json({
    publicUrl,
    r2Key,
    filename: r2Key.split('/').pop() ?? r2Key,
    mimeType: file.type,
    sizeBytes: buffer.length,
  })
}

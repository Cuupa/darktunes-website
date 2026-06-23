/**
 * app/api/portal/documents/upload/route.ts
 *
 * POST — upload a document (PDF or DOCX) to the private R2 documents store
 *
 * Validates: MIME type (PDF/DOCX), file size ≤ 20 MB, auth + artist ownership.
 * Stores in R2 under `documents/{artistId}/{uuid}.{ext}` and inserts a DB row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { createArtistDocument } from '@/lib/api/artistDocuments'
import { createR2Client } from '@/lib/r2Utils'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/octet-stream',
])

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc'])

const CATEGORY_VALUES = new Set(['contract', 'split_agreement', 'gema', 'other'])

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : ''
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const formData = await req.formData()
  const file = formData.get('file')
  const label = formData.get('label')
  const category = formData.get('category')
  const notes = formData.get('notes')

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')
  if (!label || typeof label !== 'string') throw new ApiError(400, 'label is required')
  if (!category || typeof category !== 'string' || !CATEGORY_VALUES.has(category)) {
    throw new ApiError(400, `category must be one of: ${[...CATEGORY_VALUES].join(', ')}`)
  }

  if (file.size > MAX_BYTES) throw new ApiError(413, 'File too large (max 20 MB)')

  const ext = getExtension(file.name)
  const mimeOk = ALLOWED_MIME_TYPES.has(file.type)
  const extOk = ALLOWED_EXTENSIONS.has(ext)

  if (!mimeOk && !extOk) {
    throw new ApiError(415, 'Only PDF and DOCX files are allowed')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const key = `documents/${artist.id}/${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const contentType = mimeOk ? file.type : (ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  )

  const doc = await createArtistDocument(supabase, {
    artistId: artist.id,
    label: label.slice(0, 255),
    category,
    filePath: key,
    fileSizeBytes: file.size,
    mimeType: contentType,
    notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
  })

  return NextResponse.json({ document: doc }, { status: 201 })
})
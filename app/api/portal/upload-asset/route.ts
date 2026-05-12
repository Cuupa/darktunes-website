import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { createR2Client } from '@/lib/r2Utils'
import { createArtistAsset, deleteArtistAsset } from '@/lib/api/artistAssets'

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
]

function extFromMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'application/zip') return 'zip'
  return 'bin'
}

async function uploadAssetToR2(
  file: File,
  artistId: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<{ key: string; url: string }> {
  const contentType = file.type || 'application/octet-stream'
  const ext = extFromMimeType(contentType)
  const key = `artist-assets/${artistId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  )

  return { key, url: `${r2PublicUrl.replace(/\/$/, '')}/${key}` }
}

async function authenticateArtist(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  return { supabase, artist }
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, artist } = await authenticateArtist(req)

  const formData = await req.formData()
  const file = formData.get('file')
  const label = formData.get('label')

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  const maxBytes = 20 * 1024 * 1024
  if (file.size > maxBytes) throw new ApiError(413, 'File too large (max 20 MB)')

  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(415, 'Unsupported file type. Allowed: JPEG, PNG, WebP, PDF, ZIP')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploaded = await uploadAssetToR2(
    file,
    artist.id,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  const asset = await createArtistAsset(supabase, {
    artist_id: artist.id,
    filename: file.name,
    original_filename: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    r2_key: uploaded.key,
    public_url: uploaded.url,
    label: typeof label === 'string' && label.trim() ? label.trim() : null,
  })

  return NextResponse.json({ asset })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { supabase, artist } = await authenticateArtist(req)

  const body: unknown = await req.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).id !== 'string'
  ) {
    throw new ApiError(400, 'Invalid payload: id is required')
  }

  const assetId = (body as { id: string }).id
  const { data: asset } = await supabase
    .from('artist_assets')
    .select('id, artist_id')
    .eq('id', assetId)
    .eq('artist_id', artist.id)
    .maybeSingle()

  if (!asset) throw new ApiError(404, 'Asset not found')

  await deleteArtistAsset(supabase, assetId)

  return NextResponse.json({ success: true })
})

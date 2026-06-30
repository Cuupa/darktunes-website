import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import type { Database } from '@/types/database'
import { createR2Client, deleteObjectFromR2 } from '@/lib/r2Utils'
import { createArtistAsset, deleteArtistAsset } from '@/lib/api/artistAssets'
import { createAssetRecord } from '@/lib/api/assets'

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
]
const MAX_ASSET_SIZE_BYTES = 20 * 1024 * 1024
const deleteSchema = z.object({ id: z.string() })

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
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return { key, url: `${r2PublicUrl.replace(/\/$/, '')}/${key}` }
}

/** Look up the asset_folder that belongs to this artist (the artist's root folder). */
async function getOrCreateArtistFolder(
  supabase: SupabaseClient<Database>,
  artistId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('asset_folders')
    .select('id')
    .eq('artist_id', artistId)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/** Lazy-create a `landing` subfolder under the artist's asset folder for Fan Page uploads. */
async function getOrCreateLandingSubfolder(
  serviceRole: SupabaseClient<Database>,
  artistId: string,
): Promise<string | null> {
  const artistFolderId = await getOrCreateArtistFolder(serviceRole, artistId)
  if (!artistFolderId) return null

  const { data: existing } = await serviceRole
    .from('asset_folders')
    .select('id')
    .eq('parent_id', artistFolderId)
    .eq('name', 'landing')
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await serviceRole
    .from('asset_folders')
    .insert({
      name: 'landing',
      parent_id: artistFolderId,
      artist_id: artistId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return created?.id ?? null
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const artistId = url.searchParams.get('artistId')
  const source = url.searchParams.get('source')
  const { supabase, artist, user } = await authenticatePortalBearerWithArtist(req, artistId)
  const userId = user.id

  const formData = await req.formData()
  const file = formData.get('file')
  const label = formData.get('label')
  const suggestForPress = formData.get('pressSuggested') === 'true'

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')

  if (file.size > MAX_ASSET_SIZE_BYTES) throw new ApiError(413, 'File too large (max 20 MB)')

  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(415, 'Unsupported file type. Allowed: JPEG, PNG, WebP, PDF, ZIP')
  }

  // Enforce per-artist storage quota when one has been configured
  if (artist.storageQuotaBytes != null && artist.storageQuotaBytes > 0) {
    const { data: usageData } = await supabase
      .from('assets')
      .select('size_bytes')
      .eq('artist_id', artist.id)
    const usedBytes = (usageData ?? []).reduce((sum, row) => sum + (row.size_bytes ?? 0), 0)
    if (usedBytes + file.size > artist.storageQuotaBytes) {
      throw new ApiError(507, 'Storage quota exceeded. Please contact your label to increase your quota.')
    }
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

  const isLandingUpload = source === 'landing'
  const serviceRole = await createServiceRoleSupabaseClient()

  // Get artist's folder id (auto-created by DB trigger on artist insert)
  const folderId = isLandingUpload
    ? await getOrCreateLandingSubfolder(serviceRole, artist.id)
    : await getOrCreateArtistFolder(supabase, artist.id)

  // Write DB records. On failure, delete the already-uploaded R2 object so it
  // doesn't become an orphaned (cost-incurring) file in the bucket.
  const isImage = file.type.startsWith('image/')
  const pressSuggested = suggestForPress && isImage

  let asset
  let mainAssetId: string | null = null
  try {
    // Portal artists cannot insert into `assets` under RLS — use service role.
    const mainAsset = await createAssetRecord(serviceRole, {
      filename: file.name,
      original_filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      r2_key: uploaded.key,
      public_url: uploaded.url,
      uploaded_by: userId,
      folder_id: folderId,
      artist_id: artist.id,
      press_suggested: pressSuggested,
      tags: isLandingUpload ? ['landing_editor'] : undefined,
    })
    mainAssetId = mainAsset.id

    asset = await createArtistAsset(supabase, {
      artist_id: artist.id,
      filename: file.name,
      original_filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      r2_key: uploaded.key,
      public_url: uploaded.url,
      label: typeof label === 'string' && label.trim() ? label.trim() : null,
    })
  } catch (dbErr) {
    // Compensating transaction: remove the R2 object to avoid orphaned storage
    try {
      await deleteObjectFromR2(uploaded.key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
    } catch {
      console.error('[upload-asset] R2 rollback failed for key:', uploaded.key)
    }
    throw dbErr
  }

  if (pressSuggested && mainAssetId) {
    const { data: recipientProfiles } = await serviceRole
      .from('users')
      .select('id')
      .in('role', ['admin', 'editor'])

    const recipients = (recipientProfiles ?? []).map((profile) => ({
      recipient_id: profile.id,
      type: 'press_asset_suggestion',
      entity_type: 'asset',
      entity_id: mainAssetId,
      entity_name: `${artist.name}: ${file.name}`,
      sender_id: userId,
      read: false,
    }))

    if (recipients.length > 0) {
      await serviceRole.from('editor_notifications').insert(recipients)
    }
  }

  return NextResponse.json({ asset })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = new URL(req.url).searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const body = deleteSchema.parse(await req.json())
  const assetId = body.id
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

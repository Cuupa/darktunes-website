'use server'

/**
 * src/actions/epkUpload.ts
 *
 * Server Action: generate a presigned PUT URL so an admin can upload EPK
 * assets (press photos, promo tracks) directly to Cloudflare R2 from the
 * browser — bypassing Vercel's 4.5 MB Serverless Function body limit.
 *
 * Flow:
 *   1. Admin client calls getEpkUploadUrl(category, filename, contentType)
 *   2. Server verifies admin role and returns { url, r2Key, publicUrl }
 *   3. Client PUTs the file directly to R2 with the presigned url
 *   4. Client then calls the appropriate DAL insert function with r2Key / publicUrl
 *
 * Security: admin-only; throws for any other role.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createR2Client } from '@/lib/r2Utils'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

/** Admin upload links expire in 15 minutes. */
const UPLOAD_EXPIRY_SECONDS = 900

export type EpkUploadCategory = 'press-photos' | 'promo-tracks'

export async function getEpkUploadUrl(
  category: EpkUploadCategory,
  filename: string,
  contentType: string,
): Promise<{ url: string; r2Key: string; publicUrl: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden: admin only')
  }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? ''
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? ''
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''
  const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL ?? ''

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !r2PublicUrl) {
    throw new Error('R2 credentials not configured')
  }

  const ext = filename.split('.').pop() ?? 'bin'
  const r2Key = `${category}/${randomUUID()}.${ext}`
  const publicUrl = `${r2PublicUrl.replace(/\/$/, '')}/${r2Key}`

  const s3 = createR2Client(accountId, accessKeyId, secretAccessKey)
  const command = new PutObjectCommand({ Bucket: bucket, Key: r2Key, ContentType: contentType })
  const url = await getSignedUrl(s3, command, { expiresIn: UPLOAD_EXPIRY_SECONDS })

  return { url, r2Key, publicUrl }
}

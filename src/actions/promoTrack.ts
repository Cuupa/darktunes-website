'use server'

/**
 * src/actions/promoTrack.ts
 *
 * Server Action: generate a short-lived presigned GET URL for a private
 * promo track stored in Cloudflare R2.
 *
 * Security:
 *   - Verifies the caller is authenticated.
 *   - Verifies the caller has the 'journalist' or 'admin' role.
 *   - Returns a presigned URL valid for 15 minutes — the R2 key is never
 *     exposed in the page HTML; the URL is only generated on explicit user action.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { isPressAudioPreviewEnabled, isPromoPoolEnabled } from '@/lib/pressAccess'
import { authorizePressObject, recordPromoNdaAcceptance } from '@/lib/api/pressObjectAccess'
import { mintPromoNdaToken } from '@/lib/press/promoNdaToken'
import { createR2Client } from '@/lib/r2Utils'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/** Presigned GET URL expires in 15 minutes. */
const STREAM_EXPIRY_SECONDS = 900

export async function getPromoTrackStreamUrl(r2Key: string): Promise<{ url: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['journalist', 'admin'].includes(role)) {
    throw new Error('Forbidden')
  }

  const [promoPoolEnabled, audioPreviewEnabled] = await Promise.all([
    isPromoPoolEnabled(supabase),
    isPressAudioPreviewEnabled(supabase),
  ])
  if (!promoPoolEnabled || !audioPreviewEnabled) {
    throw new Error('Forbidden')
  }

  const grant = await authorizePressObject(supabase, r2Key, {
    intent: 'stream',
    journalistId: user.id,
  })
  if (!grant) throw new Error('Forbidden')
  if (!grant.sign) return { url: grant.stored }

  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? ''
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? ''
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2 credentials not configured')
  }

  const s3 = createR2Client(accountId, accessKeyId, secretAccessKey)
  const command = new GetObjectCommand({ Bucket: bucket, Key: grant.stored })
  const url = await getSignedUrl(s3, command, { expiresIn: STREAM_EXPIRY_SECONDS })

  return { url }
}

export async function acceptPromoTrackNda(r2Key: string): Promise<{ token: string | null }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)
  if (!role || !['journalist', 'admin'].includes(role)) {
    throw new Error('Forbidden')
  }

  const secret = process.env.API_CREDENTIALS_ENCRYPTION_KEY
  if (!secret) return { token: null }
  const ok = await recordPromoNdaAcceptance(supabase, r2Key, user.id)
  if (!ok) return { token: null }
  return { token: mintPromoNdaToken(secret, user.id, r2Key.trim()) }
}

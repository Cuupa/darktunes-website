'use server'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedDownloadUrl } from '@/lib/portal/presignedUrl'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'

export async function getMarketingAssetDownloadUrl(assetId: string): Promise<{ url: string | null }> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { url: null }

    const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
    if (!artist) return { url: null }

    const { data: asset, error } = await supabase
      .from('assets')
      .select('r2_key')
      .eq('id', assetId)
      .single()
    if (error || !asset) return { url: null }

    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )
    const url = await generatePresignedDownloadUrl(asset.r2_key, {
      getSignedUrl,
      s3Client: s3,
      bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    })
    return { url }
  } catch {
    return { url: null }
  }
}

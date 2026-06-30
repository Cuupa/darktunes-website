'use server'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedDownloadUrl } from '@/lib/portal/presignedUrl'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { isPressAudioPreviewEnabled, isPromoPoolEnabled } from '@/lib/pressAccess'

export async function getPromoStreamUrl(r2Key: string): Promise<{ url: string | null }> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { url: null }

    const role = await getUserRoleWithClient(supabase, user.id)
    if (!role || !['journalist', 'admin'].includes(role)) return { url: null }

    const [promoPoolEnabled, audioPreviewEnabled] = await Promise.all([
      isPromoPoolEnabled(supabase),
      isPressAudioPreviewEnabled(supabase),
    ])
    if (!promoPoolEnabled || !audioPreviewEnabled) return { url: null }

    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )
    const url = await generatePresignedDownloadUrl(r2Key, {
      getSignedUrl,
      s3Client: s3,
      bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    })
    return { url }
  } catch {
    return { url: null }
  }
}

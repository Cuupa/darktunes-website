'use server'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedDownloadUrl } from '@/lib/portal/presignedUrl'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { authorizePressObject } from '@/lib/api/pressObjectAccess'
import { logDownload } from '@/lib/api/journalistDownloads'

export async function getJournalistDownloadUrl(
  assetKey: string,
  releaseId: string | null,
  _assetId?: string | null,
  ndaToken?: string,
): Promise<{ url: string | null }> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { url: null }

    const role = await getUserRoleWithClient(supabase, user.id)
    if (!role || !['journalist', 'admin'].includes(role)) return { url: null }

    const grant = await authorizePressObject(supabase, assetKey, {
      intent: 'download',
      journalistId: user.id,
      ndaToken,
      ndaSecret: process.env.API_CREDENTIALS_ENCRYPTION_KEY,
      releaseId,
    })
    if (!grant) return { url: null }

    let url = grant.stored
    if (grant.sign) {
      const { serverEnv } = await import('@/lib/env.server')
      const s3 = createR2Client(
        serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
        serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
        serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      )
      url = await generatePresignedDownloadUrl(grant.stored, {
        getSignedUrl,
        s3Client: s3,
        bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      })
    }

    if (!grant.alreadyLogged) {
      await logDownload(supabase, {
        journalist_id: user.id,
        release_id: grant.releaseId,
        asset_id: grant.assetId,
        asset_key: grant.stored,
      })
    }
    return { url }
  } catch {
    return { url: null }
  }
}

'use server'

/**
 * app/portal/statements/_actions/presignedUrl.ts — Server Action
 *
 * Generates a short-lived (5-minute) presigned GET URL for a private R2 PDF.
 *
 * Security:
 *   - Only callable from Server Components / Client Components within the same app
 *   - Verifies the caller owns the statement before generating a URL
 *   - Credentials never leave the server; the URL is opaque to the client
 *   - URL expires in 300 seconds (5 minutes) to limit exposure window
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { createR2Client } from '@/lib/r2Utils'
import { generatePresignedDownloadUrl } from '@/lib/portal/presignedUrl'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface PresignedUrlResult {
  url: string | null
  error: string | null
}

/**
 * Server Action: generate a presigned download URL for the given statement ID.
 *
 * @param statementId - The UUID of the sales_statement row to download
 * @returns { url, error } — url is null on failure; error is null on success
 */
export async function getStatementPresignedUrl(statementId: string): Promise<PresignedUrlResult> {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { url: null, error: 'Not authenticated' }

    const artist = await getArtistByUserId(supabase, user.id)
    if (!artist) return { url: null, error: 'No artist linked to this account' }

    // Fetch all statements for the artist — RLS ensures only own rows come back
    const statements = await getSalesStatementsByArtistId(supabase, artist.id)
    const statement = statements.find((s) => s.id === statementId)

    if (!statement) {
      return { url: null, error: 'Statement not found or access denied' }
    }

    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )

    const url = await generatePresignedDownloadUrl(statement.r2Key, {
      getSignedUrl,
      s3Client: s3,
      bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    })

    return { url, error: null }
  } catch (err) {
    console.error('[getStatementPresignedUrl] Error:', err)
    return {
      url: null,
      error: err instanceof Error ? err.message : 'Unexpected error',
    }
  }
}

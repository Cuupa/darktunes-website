import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getArtistById } from '@/lib/api/artists'
import type { SalesStatement } from '@/lib/api/salesStatements'
import { sendStatementNotification } from '@/lib/email/sendStatementNotification'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

type DbClient = SupabaseClient<Database>

export async function notifyStatementArtist(
  db: DbClient,
  statement: SalesStatement,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<{ success: boolean; error?: string }> {
  const artist = await getArtistById(db, statement.artistId)
  if (!artist) {
    return { success: false, error: `Artist ${statement.artistId} not found` }
  }

  const emailCredentials = await getEmailCredentials(db)
  return sendStatementNotification(
    artist,
    {
      filename: statement.filename,
      period: statement.period,
      amountEur: statement.amountEur,
    },
    {
      resendApiKey: emailCredentials.resendApiKey ?? '',
      resendFromEmail: emailCredentials.resendFromEmail ?? 'noreply@darktunes.com',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com',
      fetch: fetchFn,
    },
  )
}
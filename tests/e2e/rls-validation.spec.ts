import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseEnvConfigured } from '@/lib/supabase/isConfigured'

const SENSITIVE_TABLES = [
  'artists',
  'releases',
  'users',
  'sales_statements',
  'artist_assets',
  'artist_profiles',
  'promo_tracks',
  'newsletter_subscribers',
]

type PgTableRow = {
  tablename: string
  rowsecurity: boolean
}

test('RLS is enabled on all sensitive tables', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!isSupabaseEnvConfigured() || !url || !serviceKey) {
    test.skip(true, 'Real Supabase service role env vars are missing')
    return
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client
    .schema('pg_catalog')
    .from('pg_tables')
    .select('tablename, rowsecurity')
    .eq('schemaname', 'public')
    .in('tablename', SENSITIVE_TABLES)

  if (error) {
    throw error
  }

  const rows = (data ?? []) as PgTableRow[]
  const byTable = new Map(rows.map((row) => [row.tablename, row.rowsecurity]))

  for (const tableName of SENSITIVE_TABLES) {
    expect(byTable.has(tableName), `Table not found in pg_tables: ${tableName}`).toBe(true)
    expect(byTable.get(tableName), `RLS must be enabled for table: ${tableName}`).toBe(true)
  }
})

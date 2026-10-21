/**
 * scripts/apply-schema.mjs
 *
 * Applies supabase/reset.sql to the target database.
 *
 * The schema is applied with the `pg` client (no external `psql` binary
 * required, so it runs on Vercel as part of the install hook).
 * `reset.sql` is idempotent — safe to run on every deploy.
 *
 * Scheduled jobs (sync worker tick, daily enqueue, daily YouTube sync, etc.)
 * are NOT managed here — they are plain HTTPS jobs configured directly in the
 * Supabase dashboard (Integrations → Cron). This script never touches Vault
 * or cron.
 *
 * Required env:
 *   SUPABASE_DB_URL (or DATABASE_URL) — Postgres connection string
 *
 * Usage: npm run db:apply
 */

import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const resetPath = join(root, 'supabase', 'reset.sql')
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

async function applySchema() {
  if (!existsSync(resetPath)) {
    throw new Error(`reset.sql not found at ${resetPath}`)
  }

  const sql = readFileSync(resetPath, 'utf8')
  const client = new Client({ connectionString: dbUrl })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

async function main() {
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) is required')
  }

  await applySchema()

  console.log('[apply-schema] done')
}

main().catch((err) => {
  console.error('[apply-schema] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

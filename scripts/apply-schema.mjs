/**
 * scripts/apply-schema.mjs
 *
 * Applies supabase/reset.sql to the target database and upserts the Supabase
 * Vault secrets used by the pg_cron sync scheduler.
 *
 * The schema is applied with `psql` (statement-by-statement, matching the
 * Supabase SQL editor semantics — avoids the single-implicit-transaction
 * problem with `ALTER TYPE … ADD VALUE`).
 *
 * Required env:
 *   SUPABASE_DB_URL (or DATABASE_URL) — Postgres connection string
 *     (direct connection or session pooler, NOT the transaction pooler, so
 *      Vault upserts can run on the same session).
 *   CRON_SECRET                       — mirrored to Vault as `cron_secret`
 *   SUPABASE_SITE_URL | NEXT_PUBLIC_SITE_URL — mirrored to Vault as `site_url`
 *
 * Usage: npm run db:apply
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const resetPath = join(root, 'supabase', 'reset.sql')
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const siteUrl = process.env.SUPABASE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
const cronSecret = process.env.CRON_SECRET

function applySchema() {
  if (!existsSync(resetPath)) {
    throw new Error(`reset.sql not found at ${resetPath}`)
  }

  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', resetPath], {
    stdio: 'inherit',
  })

  if (result.error) {
    throw new Error(
      `psql could not be started (${result.error.message}). Install the PostgreSQL client tools.`,
    )
  }
  if (result.status !== 0) {
    throw new Error(`psql exited with status ${result.status}`)
  }
}

async function upsertVaultSecret(client, name, value, description) {
  if (!value) {
    console.warn(`[apply-schema] ${name} not provided — skipping Vault upsert`)
    return
  }

  const { rows } = await client.query('SELECT id FROM vault.secrets WHERE name = $1 LIMIT 1', [
    name,
  ])

  if (rows[0]) {
    await client.query('SELECT vault.update_secret($1, $2)', [rows[0].id, value])
    console.log(`[apply-schema] updated Vault secret: ${name}`)
  } else {
    await client.query('SELECT vault.create_secret($1, $2, $3)', [value, name, description])
    console.log(`[apply-schema] created Vault secret: ${name}`)
  }
}

async function main() {
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL (or DATABASE_URL) is required')
  }

  applySchema()

  const client = new pg.Client({ connectionString: dbUrl })
  await client.connect()
  try {
    await upsertVaultSecret(client, 'site_url', siteUrl, 'darkTunes public site URL')
    await upsertVaultSecret(client, 'cron_secret', cronSecret, 'darkTunes cron secret (Bearer)')
  } finally {
    await client.end()
  }

  console.log('[apply-schema] done')
}

main().catch((err) => {
  console.error('[apply-schema] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})

/**
 * Static + optional live check: expected portal RLS policies ⊆ supabase/reset.sql
 * (and optionally exist in a live database).
 *
 * Usage:
 *   node scripts/verify-portal-rls.mjs
 *   VERIFY_PORTAL_RLS_DATABASE_URL=postgres://... node scripts/verify-portal-rls.mjs
 *
 * Exit 0 = ok; 1 = missing policies in reset.sql or live DB.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sqlPath = join(root, 'scripts', 'verify-portal-rls.sql')
const resetPath = join(root, 'supabase', 'reset.sql')

function extractExpectedPolicies(verifySql) {
  const block = verifySql.match(/WITH expected\(table_name, policy_name\) AS \(\s*VALUES([\s\S]*?)\)\s*SELECT/i)
  if (!block) throw new Error('Could not parse expected VALUES block from verify-portal-rls.sql')
  const pairs = []
  const re = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g
  let m
  while ((m = re.exec(block[1])) !== null) {
    pairs.push({ table: m[1], policy: m[2] })
  }
  if (pairs.length === 0) throw new Error('No expected policies parsed')
  return pairs
}

function extractCreatePolicyNames(resetSql) {
  const names = new Set()
  const re = /CREATE\s+POLICY\s+"([^"]+)"/gi
  let m
  while ((m = re.exec(resetSql)) !== null) {
    names.add(m[1])
  }
  return names
}

function mainStatic() {
  if (!existsSync(sqlPath) || !existsSync(resetPath)) {
    console.error('[verify-portal-rls] Missing verify-portal-rls.sql or supabase/reset.sql')
    process.exit(1)
  }
  const verifySql = readFileSync(sqlPath, 'utf8')
  const resetSql = readFileSync(resetPath, 'utf8')
  const expected = extractExpectedPolicies(verifySql)
  const created = extractCreatePolicyNames(resetSql)

  const missing = expected.filter((e) => !created.has(e.policy))
  if (missing.length > 0) {
    console.error('[verify-portal-rls] FAIL: expected policies not found in reset.sql CREATE POLICY:')
    for (const m of missing) {
      console.error(`  - ${m.table}: "${m.policy}"`)
    }
    process.exit(1)
  }

  console.log(
    `[verify-portal-rls] OK: ${expected.length} expected policies are defined in reset.sql`,
  )
}

async function mainLive() {
  const url = process.env.VERIFY_PORTAL_RLS_DATABASE_URL?.trim()
  if (!url) {
    console.log('[verify-portal-rls] Live check skipped (VERIFY_PORTAL_RLS_DATABASE_URL not set)')
    return
  }

  // Optional dependency — only used when live URL is provided
  let pg
  try {
    pg = await import('pg')
  } catch {
    console.error(
      '[verify-portal-rls] Live check requested but `pg` is not installed. npm i -D pg',
    )
    process.exit(1)
  }

  const verifySql = readFileSync(sqlPath, 'utf8')
  const expected = extractExpectedPolicies(verifySql)
  const client = new pg.default.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query(
      `
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
      `,
    )
    const live = new Set(rows.map((r) => r.policyname))
    const missing = expected.filter((e) => !live.has(e.policy))
    if (missing.length > 0) {
      console.error('[verify-portal-rls] FAIL: expected policies missing in live database:')
      for (const m of missing) {
        console.error(`  - ${m.table}: "${m.policy}"`)
      }
      process.exit(1)
    }
    console.log(`[verify-portal-rls] OK live: ${expected.length} policies present in database`)
  } finally {
    await client.end()
  }
}

mainStatic()
await mainLive()

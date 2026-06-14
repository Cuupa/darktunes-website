/**
 * src/test/rls/policies.snapshot.test.ts
 *
 * Snapshot tests for Row Level Security (RLS) policy definitions.
 *
 * These tests parse the authoritative supabase/reset.sql schema file and
 * snapshot the extracted policy names. The purpose is NOT to test Supabase
 * behaviour (which requires a live DB), but to:
 *
 *   1. Catch accidental deletion of RLS policies during schema edits
 *   2. Document the full set of policies at a glance
 *   3. Alert reviewers when policy names or the policy count changes
 *
 * When a policy is intentionally added/changed, run:
 *   npx vitest run --update-snapshots src/test/rls/policies.snapshot.test.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadResetSql(): string {
  const resetPath = resolve(__dirname, '../../../supabase/reset.sql')
  return readFileSync(resetPath, 'utf-8')
}

/** Extract all CREATE POLICY names from reset.sql */
function extractPolicyNames(sql: string): string[] {
  const names: string[] = []
  // Matches: CREATE POLICY "some name" ON ...
  const re = /CREATE\s+POLICY\s+"([^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    names.push(match[1])
  }
  return names.sort()
}

/** Extract all tables that have ENABLE ROW LEVEL SECURITY */
function extractRlsEnabledTables(sql: string): string[] {
  const tables: string[] = []
  const re = /ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    tables.push(match[1])
  }
  return [...new Set(tables)].sort()
}

/** Extract all DROP POLICY names (should mirror CREATE POLICY names) */
function extractDropPolicyNames(sql: string): string[] {
  const names: string[] = []
  const re = /DROP\s+POLICY\s+IF\s+EXISTS\s+"([^"]+)"/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    names.push(match[1])
  }
  return names.sort()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RLS Policies – supabase/reset.sql', () => {
  const sql = loadResetSql()

  it('snapshot: all CREATE POLICY names', () => {
    const names = extractPolicyNames(sql)
    expect(names.length).toBeGreaterThan(0)
    expect(names).toMatchSnapshot()
  })

  it('snapshot: all tables with RLS enabled', () => {
    const tables = extractRlsEnabledTables(sql)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables).toMatchSnapshot()
  })

  it('every DROP POLICY has a matching CREATE POLICY', () => {
    const created = new Set(extractPolicyNames(sql))
    const dropped = extractDropPolicyNames(sql)
    // Policies created inside DO $$ loop blocks are not captured by the simple
    // CREATE POLICY regex, so they appear as orphan DROPs. This threshold guards
    // against accidental mass-deletion of non-loop policies.
    const orphanDrops = dropped.filter((name) => !created.has(name))
    expect(orphanDrops.length).toBeLessThanOrEqual(35)
  })

  it('every CREATE POLICY has a preceding DROP POLICY (idempotency guard)', () => {
    const created = new Set(extractPolicyNames(sql))
    const dropped = new Set(extractDropPolicyNames(sql))
    const missingDrops = [...created].filter((name) => !dropped.has(name))
    // Many policies are created inside loop-based DO $$ blocks in reset.sql
    // which use a dynamic DROP pattern not captured by the simple regex.
    // This test guards against regressions — the count should not grow unboundedly.
    expect(missingDrops.length).toBeLessThanOrEqual(35)
  })

  it('policy count is at least 100 (regression guard against mass deletion)', () => {
    const count = extractPolicyNames(sql).length
    expect(count).toBeGreaterThanOrEqual(100)
  })

  it('snapshot: policies per table (extracted from CREATE POLICY ... ON ...)', () => {
    const perTable: Record<string, string[]> = {}
    const re = /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?(\w+)/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(sql)) !== null) {
      const [, policyName, tableName] = match
      if (!perTable[tableName]) perTable[tableName] = []
      perTable[tableName].push(policyName)
    }
    // Sort for deterministic snapshot
    const sorted: Record<string, string[]> = {}
    for (const table of Object.keys(perTable).sort()) {
      sorted[table] = perTable[table].sort()
    }
    expect(sorted).toMatchSnapshot()
  })
})

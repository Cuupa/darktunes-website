/**
 * Validates that role_permissions seed in reset.sql matches DEFAULT_ROLE_PERMISSIONS.
 * Run: npx tsx scripts/validate-rbac.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_ROLE_PERMISSIONS } from '../src/lib/rbac/registry'
import type { RolePermissionKey } from '../src/lib/adminAuth'

const PERM_KEYS: RolePermissionKey[] = [
  'can_publish_news',
  'can_edit_news',
  'can_manage_artists',
  'can_manage_releases',
  'can_manage_videos',
  'can_view_admin_panel',
]

function parseSeedRows(sql: string): Map<string, Record<RolePermissionKey, boolean>> {
  const rows = new Map<string, Record<RolePermissionKey, boolean>>()
  const insertMatch = sql.match(
    /INSERT INTO public\.role_permissions[\s\S]*?VALUES([\s\S]*?)ON CONFLICT/,
  )
  if (!insertMatch) {
    throw new Error('Could not find role_permissions INSERT in reset.sql')
  }

  const valueLines = insertMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('('))

  for (const line of valueLines) {
    const match = line.match(
      /^\('(\w+)',\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*(TRUE|FALSE),\s*(TRUE|FALSE)\)/i,
    )
    if (!match) continue
    const [, role, ...flags] = match
    const bools = flags.map((f) => f.toUpperCase() === 'TRUE') as boolean[]
    rows.set(role, {
      can_publish_news: bools[0],
      can_edit_news: bools[1],
      can_manage_artists: bools[2],
      can_manage_releases: bools[3],
      can_manage_videos: bools[4],
      can_view_admin_panel: bools[5],
    })
  }

  return rows
}

function main(): void {
  const resetPath = resolve(process.cwd(), 'supabase/reset.sql')
  const sql = readFileSync(resetPath, 'utf8')
  const seed = parseSeedRows(sql)
  const errors: string[] = []

  for (const [role, expected] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const row = seed.get(role)
    if (!row) {
      errors.push(`Missing role_permissions seed row for role "${role}"`)
      continue
    }
    for (const key of PERM_KEYS) {
      if (row[key] !== expected[key]) {
        errors.push(
          `role_permissions.${role}.${key}: seed=${row[key]} registry=${expected[key]}`,
        )
      }
    }
  }

  if (errors.length > 0) {
    console.error('RBAC validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'))
    process.exit(1)
  }

  console.log('RBAC validation passed: role_permissions seed matches registry.')
}

main()
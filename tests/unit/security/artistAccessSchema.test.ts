import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const sql = readFileSync('supabase/reset.sql', 'utf8')

describe('database authorization boundaries', () => {
  it('qualifies outer artist references in every membership policy', () => {
    const policies = [...sql.matchAll(/CREATE POLICY\s+"[^"]+"\s+ON public\.\w+[\s\S]*?;/g)].map((match) => match[0])
    expect(policies.length).toBeGreaterThan(100)
    for (const policy of policies) {
      expect(policy).not.toMatch(/am\.artist_id\s*=\s*(?:artist_id|id|am\.artist_id|am\.id)\b/)
    }
  })

  it('never trusts editable metadata in signup or OAuth authorization', () => {
    for (const name of ['handle_new_auth_user', 'handle_oauth_artist_verification']) {
      const definition = sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(\\)[\\s\\S]*?\\n\\$\\$;`))?.[0]
      expect(definition).toBeTruthy()
      expect(definition).not.toContain('raw_user_meta_data')
    }
  })

  it('guards access columns and revokes legacy explicit RPC grants', () => {
    expect(sql).toContain('CREATE TRIGGER guard_profile_access_columns BEFORE UPDATE ON public.users')
    expect(sql).toContain('CREATE TRIGGER guard_artist_access_columns BEFORE UPDATE ON public.artists')
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain("'create_release_submission_with_tracks','replace_rejected_release_submission_with_tracks'")
  })
})

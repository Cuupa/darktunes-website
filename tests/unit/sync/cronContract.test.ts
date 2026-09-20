import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeAll } from 'vitest'

let sql: string

beforeAll(() => {
  sql = readFileSync(resolve(__dirname, '../../../supabase/reset.sql'), 'utf-8')
})

describe('reset.sql — pg_cron scheduler contract', () => {
  it('registers the worker tick every minute', () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'sync-worker',\s*'\* \* \* \* \*'/)
  })

  it('registers the scheduler heartbeat', () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'scheduler-heartbeat'/)
  })

  it('registers the daily enqueue and youtube jobs', () => {
    expect(sql).toMatch(/'sync-enqueue-daily'/)
    expect(sql).toMatch(/'sync-youtube-daily'/)
  })

  it('defines the trigger functions that read secrets from Vault', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.trigger_sync_worker/)
    expect(sql).toMatch(/vault\.decrypted_secrets/)
    expect(sql).toMatch(/net\.http_post/)
  })

  it('defines the atomic claim function using FOR UPDATE SKIP LOCKED', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.claim_sync_jobs/)
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/)
  })

  it('defines the ledger, tick and lease tables with RLS', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.sync_runs/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.cron_ticks/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.sync_worker_lease/)
    expect(sql).toMatch(/ALTER TABLE public\.sync_runs ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE public\.cron_ticks ENABLE ROW LEVEL SECURITY/)
  })

  it('does not reference the removed trigger-sync edge function', () => {
    expect(sql).not.toMatch(/trigger-sync/)
  })
})

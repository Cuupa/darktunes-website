import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createEditorActivityLogEntry,
  getEditorActivityLogByEditorId,
} from './editorActivityLog'

type DbClient = SupabaseClient<Database>
type EditorLogRow = Database['public']['Tables']['editor_activity_log']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const row: EditorLogRow = {
  id: 'log-1',
  editor_id: 'editor-1',
  action: 'create',
  entity_type: 'release',
  entity_id: '11111111-1111-1111-1111-111111111111',
  entity_name: 'Release',
  changes: { title: 'Release' },
  created_at: '2026-01-01T00:00:00Z',
}

describe('createEditorActivityLogEntry', () => {
  it('creates a log entry', async () => {
    const db = makeMockDb(row)
    const result = await createEditorActivityLogEntry(db, {
      editor_id: 'editor-1',
      action: 'create',
      entity_type: 'release',
      entity_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(result.id).toBe('log-1')
    expect(result.entityType).toBe('release')
  })
})

describe('getEditorActivityLogByEditorId', () => {
  it('returns mapped rows', async () => {
    const db = makeMockDb([row])
    const result = await getEditorActivityLogByEditorId(db, 'editor-1')
    expect(result).toHaveLength(1)
    expect(result[0].editorId).toBe('editor-1')
  })
})

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getFormSchema,
  getAllFormSchemaFields,
  upsertFormField,
  deleteFormField,
} from './submissionFormSchema'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
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

const row = {
  id: 'field-1',
  form_type: 'release' as const,
  field_key: 'genre',
  field_label_en: 'Genre',
  field_label_de: 'Genre',
  field_type: 'text' as const,
  field_options: null,
  is_required: false,
  is_visible: true,
  display_order: 5,
  placeholder_en: 'e.g. Techno',
  placeholder_de: 'z.B. Techno',
}

describe('submissionFormSchema DAL', () => {
  it('getFormSchema returns mapped visible fields', async () => {
    const db = makeMockDb([row])
    const fields = await getFormSchema(db, 'release')
    expect(fields).toHaveLength(1)
    expect(fields[0].id).toBe('field-1')
    expect(fields[0].fieldKey).toBe('genre')
    expect(fields[0].fieldLabelEn).toBe('Genre')
    expect(fields[0].isVisible).toBe(true)
    expect(fields[0].displayOrder).toBe(5)
  })

  it('getFormSchema returns empty array on null data', async () => {
    const db = makeMockDb(null)
    const fields = await getFormSchema(db, 'release')
    expect(fields).toHaveLength(0)
  })

  it('getFormSchema throws on error', async () => {
    const db = makeMockDb(null, { message: 'DB error' })
    await expect(getFormSchema(db, 'release')).rejects.toThrow('DB error')
  })

  it('getAllFormSchemaFields returns all fields including hidden', async () => {
    const hiddenRow = { ...row, id: 'field-2', is_visible: false }
    const db = makeMockDb([row, hiddenRow])
    const fields = await getAllFormSchemaFields(db, 'release')
    expect(fields).toHaveLength(2)
    expect(fields[1].isVisible).toBe(false)
  })

  it('upsertFormField returns the upserted field', async () => {
    const db = makeMockDb(row)
    const result = await upsertFormField(db, {
      form_type: 'release',
      field_key: 'genre',
      field_label_en: 'Genre',
      field_label_de: 'Genre',
      field_type: 'text',
    })
    expect(result.fieldKey).toBe('genre')
    expect(result.formType).toBe('release')
  })

  it('upsertFormField throws when no data returned', async () => {
    const db = makeMockDb(null)
    await expect(
      upsertFormField(db, {
        form_type: 'release',
        field_key: 'genre',
        field_label_en: 'Genre',
        field_label_de: 'Genre',
        field_type: 'text',
      }),
    ).rejects.toThrow('No data returned')
  })

  it('deleteFormField resolves without error', async () => {
    const db = makeMockDb(null, null)
    await expect(deleteFormField(db, 'field-1')).resolves.toBeUndefined()
  })

  it('deleteFormField throws on error', async () => {
    const db = makeMockDb(null, { message: 'Cannot delete' })
    await expect(deleteFormField(db, 'field-1')).rejects.toThrow('Cannot delete')
  })
})

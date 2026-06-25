import { describe, expect, it, vi } from 'vitest'
import {
  ensureDefaultRulesPreset,
  getRulesPresetByName,
  upsertRulesPresetByName,
} from './sosRulesPresets'
import { DEFAULT_PRESET_NAME } from '@/lib/sos/sosAccountingSettings'

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  return builder
}

describe('sosRulesPresets DAL', () => {
  it('ensureDefaultRulesPreset returns existing Default preset', async () => {
    const row = {
      id: 'preset-1',
      name: DEFAULT_PRESET_NAME,
      config: {
        artistMappings: [{
          id: '1',
          featuringName: 'Feat',
          primaryArtist: 'Artist A',
        }],
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }
    const builder = makeBuilder(row)
    const db = { from: vi.fn(() => builder) } as never

    const preset = await ensureDefaultRulesPreset(db)
    expect(preset.name).toBe(DEFAULT_PRESET_NAME)
    expect(preset.config.artistMappings).toHaveLength(1)
  })

  it('upsertRulesPresetByName updates when name already exists', async () => {
    const existing = {
      id: 'preset-2',
      name: 'Q1',
      config: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    const updated = {
      ...existing,
      config: { splitFees: [{ artist: 'X', percentage: 50 }] },
      updated_at: '2024-01-03T00:00:00Z',
    }

    const lookupBuilder = makeBuilder(existing)
    const updateBuilder = makeBuilder(updated)
    const db = {
      from: vi.fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(updateBuilder),
    } as never

    const preset = await upsertRulesPresetByName(db, {
      name: 'q1',
      config: { splitFees: [{ artist: 'X', percentage: 50 }] } as never,
    })

    expect(preset.id).toBe('preset-2')
    expect(preset.config.splitFees).toHaveLength(1)
  })

  it('getRulesPresetByName returns null when missing', async () => {
    const builder = makeBuilder(null)
    const db = { from: vi.fn(() => builder) } as never
    const preset = await getRulesPresetByName(db, 'missing')
    expect(preset).toBeNull()
  })
})
import { describe, expect, it } from 'vitest'
import { DEFAULT_SOS_ACCOUNTING_SETTINGS } from '@/lib/sos/sosAccountingSettings'
import { mergeKvIntoSettings } from '@/lib/sos/migrateKvToDb'

describe('mergeKvIntoSettings', () => {
  it('keeps current settings when they are not empty', () => {
    const current = {
      ...DEFAULT_SOS_ACCOUNTING_SETTINGS,
      artistMappings: [{
        id: '1',
        featuringName: 'Feat',
        primaryArtist: 'Artist A',
      }],
    }
    const legacy = {
      ...DEFAULT_SOS_ACCOUNTING_SETTINGS,
      splitFees: [{ artist: 'B', percentage: 70 }],
    }

    const merged = mergeKvIntoSettings(current, legacy)
    expect(merged.artistMappings).toHaveLength(1)
    expect(merged.splitFees).toHaveLength(0)
  })

  it('imports legacy settings when current is empty', () => {
    const current = { ...DEFAULT_SOS_ACCOUNTING_SETTINGS }
    const legacy = {
      ...DEFAULT_SOS_ACCOUNTING_SETTINGS,
      csvImportProfiles: [{
        id: 'p1',
        name: 'Custom',
        type: 'financial' as const,
        delimiter: ',' as const,
        autoDetectHeaders: [],
        columnMapping: {},
      }],
      labelInfo: { sepaIban: 'DE001' },
    }

    const merged = mergeKvIntoSettings(current, legacy)
    expect(merged.csvImportProfiles).toHaveLength(1)
    expect(merged.labelInfo.sepaIban).toBe('DE001')
  })
})
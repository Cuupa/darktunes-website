import { describe, expect, it } from 'vitest'
import {
  durableAccountingSettings,
  mergePeriodScopedSettings,
  normalizeAccountingConfig,
} from '@/lib/sos/sosAccountingSettings'
import { DEFAULT_PDF_EXPORT_SETTINGS } from '@/lib/sos/defaults'

describe('normalizeAccountingConfig', () => {
  it('fills defaults for missing fields', () => {
    const config = normalizeAccountingConfig({
      artistMappings: [{
        id: '1',
        featuringName: 'Feat',
        primaryArtist: 'Artist A',
      }],
      pdfSettings: { ...DEFAULT_PDF_EXPORT_SETTINGS, includePieChart: false },
    })

    expect(config.artistMappings).toHaveLength(1)
    expect(config.pdfSettings.includePieChart).toBe(false)
    expect(config.pdfSettings.includeReleaseBreakdown).toBe(
      DEFAULT_PDF_EXPORT_SETTINGS.includeReleaseBreakdown,
    )
    expect(config.csvImportProfiles).toEqual([])
    expect(config.excelExport.settings.sheets.releases).toBe(true)
    expect(config.excelExport.presets).toEqual([])
  })

  it('maps standalone SOS generator pdfExportSettings and keeps label split defaults', () => {
    const config = normalizeAccountingConfig({
      pdfExportSettings: {
        ...DEFAULT_PDF_EXPORT_SETTINGS,
        includeMonthlyBreakdown: true,
      },
      appDefaults: { defaultSplitPercentage: 50 },
    })

    expect(config.pdfSettings.includeMonthlyBreakdown).toBe(true)
    expect(config.appDefaults.defaultSplitPercentagePhysical).toBe(15)
    expect(config.appDefaults.sourceSplits).toEqual({
      believe: 50,
      bandcamp: 50,
      physical: 65,
      darkmerch: 100,
    })
    expect(config.compilationFilters).toEqual([])
    expect(config.splitFees).toEqual([])
  })

  it('normalizes a stored excel export preset from a workspace payload', () => {
    const config = normalizeAccountingConfig({
      excelExport: {
        activePresetId: 'p1',
        settings: { columns: { 'releases.upcEan': false } },
        presets: [{ id: 'p1', name: 'No UPC', settings: { columns: { 'releases.upcEan': false } } }],
      },
    })

    expect(config.excelExport.activePresetId).toBe('p1')
    expect(config.excelExport.settings.columns['releases.upcEan']).toBe(false)
    expect(config.excelExport.settings.columns['releases.title']).toBe(true)
    expect(config.excelExport.presets).toHaveLength(1)
  })
})

describe('period vs durable settings', () => {
  it('strips one-off settlement lines from reusable presets', () => {
    const full = normalizeAccountingConfig({
      splitFees: [{ artist: 'Neuroklast', percentage: 50 }],
      manualRevenues: [{ id: 'mr', artist: 'Neuroklast', description: 'Sync', amount: 15 }],
      expenses: [{ id: 'ex', artist: 'Neuroklast', description: 'Recoup', amount: 10, date: '2024-03-01' }],
      ignoredEntries: [{
        id: 'ig',
        artist: 'Neuroklast',
        createdAt: '2024-03-01T00:00:00.000Z',
      }],
    })

    const durable = durableAccountingSettings(full)
    expect(durable.splitFees).toEqual(full.splitFees)
    expect(durable.manualRevenues).toEqual([])
    expect(durable.expenses).toEqual([])
    expect(durable.ignoredEntries).toEqual([])
    expect(full.expenses).toHaveLength(1)
  })

  it('reapplies the current period lines when loading durable rules', () => {
    const durable = durableAccountingSettings(
      normalizeAccountingConfig({
        splitFees: [{ artist: 'Neuroklast', percentage: 80 }],
        expenses: [{ id: 'old', artist: 'Neuroklast', description: 'leak', amount: 99, date: '2024-01-01' }],
      }),
    )
    const merged = mergePeriodScopedSettings(durable, {
      manualRevenues: [{ id: 'mr', artist: 'Neuroklast', description: 'Sync', amount: 15 }],
      expenses: [{ id: 'ex', artist: 'Neuroklast', description: 'This period', amount: 10, date: '2024-03-01' }],
      ignoredEntries: [],
    })

    expect(merged.splitFees[0]?.percentage).toBe(80)
    expect(merged.expenses).toEqual([
      { id: 'ex', artist: 'Neuroklast', description: 'This period', amount: 10, date: '2024-03-01' },
    ])
    expect(merged.manualRevenues).toHaveLength(1)
  })
})
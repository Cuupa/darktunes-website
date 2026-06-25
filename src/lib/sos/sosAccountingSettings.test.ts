import { describe, expect, it } from 'vitest'
import { normalizeAccountingConfig } from '@/lib/sos/sosAccountingSettings'
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
  })
})
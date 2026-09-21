import { describe, expect, it } from 'vitest'
import { ExcelExportWorkerError } from '../excelExportError'
import { generateZipOfAllStatements } from './zipBundle'
import type { SafeProcessedArtistData } from '../types'

function makeArtist(name: string): SafeProcessedArtistData {
  return { artist: name, finalPayout: 10 } as unknown as SafeProcessedArtistData
}

describe('generateZipOfAllStatements Excel resilience', () => {
  it('marks a failed artist Excel, continues the ZIP and reports the skip', async () => {
    const skipped: string[] = []
    const progress: string[] = []

    const blob = await generateZipOfAllStatements(
      [makeArtist('Artist One')],
      { name: 'darkTunes', address: '' },
      '2026-03',
      '2026-03',
      'excel',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      async () => {
        throw new Error('raw limit exceeded')
      },
      (artist, phase) => progress.push(`${artist}:${phase}`),
      (artist) => skipped.push(artist),
    )

    expect(skipped).toEqual(['Artist One'])
    expect(progress).toEqual([])

    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(blob)
    expect(Object.keys(zip.files)).toContain('Artist_One_EXCEL_NOT_INCLUDED.txt')
    const note = await zip.file('Artist_One_EXCEL_NOT_INCLUDED.txt')?.async('string')
    expect(note).toContain('raw limit exceeded')
  })

  it('does not download a ZIP when original-report Excel is cancelled', async () => {
    await expect(
      generateZipOfAllStatements(
        [makeArtist('Artist One')],
        { name: 'darkTunes', address: '' },
        '2026-03',
        '2026-03',
        'excel',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        async () => {
          throw new ExcelExportWorkerError('cancelled', { code: 'EXCEL_CANCELLED' })
        },
      ),
    ).rejects.toMatchObject({ code: 'EXCEL_CANCELLED' })
  })

  it('stops when aborted so a cancelled ZIP is not downloaded', async () => {
    const controller = new AbortController()
    controller.abort()
    const signal = controller.signal
    await expect(
      generateZipOfAllStatements(
        [makeArtist('Artist One')],
        { name: 'darkTunes', address: '' },
        '2026-03',
        '2026-03',
        'excel',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        [],
        undefined,
        async () => new Blob(['xlsx']),
        undefined,
        undefined,
        signal,
      ),
    ).rejects.toThrow(/cancelled/i)
  })
})

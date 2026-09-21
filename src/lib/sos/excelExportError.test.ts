import { describe, expect, it } from 'vitest'
import {
  ExcelExportWorkerError,
  isAbortingExcelExport,
  isStaleExcelRevision,
} from './excelExportError'

describe('isStaleExcelRevision', () => {
  it('is stale only when both revisions are set and differ', () => {
    expect(isStaleExcelRevision(1, 2)).toBe(true)
    expect(isStaleExcelRevision(2, 2)).toBe(false)
    expect(isStaleExcelRevision(1, undefined)).toBe(false)
    expect(isStaleExcelRevision(undefined, 1)).toBe(false)
  })
})

describe('isAbortingExcelExport', () => {
  it('treats cancel and stale as aborting so a ZIP is not downloaded', () => {
    expect(
      isAbortingExcelExport(new ExcelExportWorkerError('x', { code: 'EXCEL_CANCELLED' })),
    ).toBe(true)
    expect(
      isAbortingExcelExport(new ExcelExportWorkerError('x', { code: 'EXCEL_STALE_REVISION' })),
    ).toBe(true)
    expect(
      isAbortingExcelExport(new ExcelExportWorkerError('x', { code: 'EXCEL_TIMEOUT' })),
    ).toBe(false)
    expect(isAbortingExcelExport(new Error('cancelled'))).toBe(false)
  })
})

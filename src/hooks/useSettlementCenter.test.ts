import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSettlementCenter } from './useSettlementCenter'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/admin/getAccessToken', () => ({ getAdminAccessToken: vi.fn().mockResolvedValue('token') }))
vi.mock('@/lib/api/settlementCenterApi', () => ({
  fetchSettlementRegister: vi.fn().mockResolvedValue({ rows: [] }),
  archiveSettlementPeriod: vi.fn(),
  bulkApproveStatements: vi.fn(),
  createStatementCorrection: vi.fn(),
  deleteSalesStatement: vi.fn(),
  lockSettlementPeriod: vi.fn(),
  markInvoiceReceived: vi.fn(),
  recordInvoicePayment: vi.fn(),
}))
vi.mock('@/lib/api/settlementReconciliation', () => ({ reconcileRegisterOpenBalance: vi.fn().mockResolvedValue({ deltaEur: 0 }) }))
vi.mock('@/lib/sos/runPersistSosAnalytics', () => ({ runPersistSosAnalytics: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/sos/lineItemsFromArtistData', () => ({ monthToPeriodDate: vi.fn(() => null) }))
vi.mock('@/lib/sos/statementWorkflow', () => ({
  countByWorkflowStatus: vi.fn(() => ({ draft: 0, approved: 0 })),
  deriveActiveWorkflowStep: vi.fn(() => 'draft'),
  deriveCompletedWorkflowSteps: vi.fn(() => []),
  workflowStatusFromStatement: vi.fn(() => 'draft'),
}))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({ useAccountingLabels: () => ({ settlementCurrentPeriod: 'Current Period' }) }))
vi.mock('@/lib/i18n/interpolate', () => ({ interpolate: vi.fn((s: string) => s) }))
vi.mock('@/components/admin/sos/settlementCenterModel', () => ({
  buildInvoiceStatusLabels: vi.fn(() => ({})),
  buildPeriodStatusLabels: vi.fn(() => ({})),
  computeNextPeriod: vi.fn(() => ({ start: '', end: '' })),
  registerToMasterRow: vi.fn((row: unknown) => row),
  rowIsSelectable: vi.fn(() => true),
}))

describe('useSettlementCenter', () => {
  it('initializes period label and exposes writable state', async () => {
    const { result } = renderHook(() => useSettlementCenter({
      revenues: [],
      labelArtists: [],
      periodStart: '',
      periodEnd: '',
      territoryMetrics: [],
      merchOrderRows: [],
      bronzeBatchIds: [],
      onCreateDraft: vi.fn(),
      onBuildCorrectionPdf: vi.fn(),
    } as never))

    await waitFor(() => {
      expect(result.current.periodLabel).toBe('Current Period')
      expect(typeof result.current.setFilter).toBe('function')
    })
  })
})

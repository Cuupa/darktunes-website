import type { SettlementRegisterRow } from '@/lib/api/settlementRegister'
import type { SalesStatementStatus } from '@/lib/api/salesStatements'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'
import {
  workflowStatusFromStatement,
  type ArtistStatementWorkflowStatus,
} from '@/lib/sos/statementWorkflow'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'

export interface SettlementCenterPanelProps {
  revenues: ArtistRevenue[]
  labelArtists: LabelArtist[]
  periodStart: string
  periodEnd: string
  territoryMetrics?: TerritoryMetricRow[]
  merchOrderRows?: MerchOrderRow[]
  bronzeBatchIds?: string[]
  persistDisabled?: boolean
  onCreateDraft: (artist: string) => Promise<void>
  onBuildCorrectionPdf?: (artistName: string, amountEur: number) => Promise<string | null>
}

export type MasterRow = {
  artistName: string
  artistId: string | null
  workflowStatus: ArtistStatementWorkflowStatus
  statementId?: string
  firstViewedAt?: string
  invoiceId?: string
  invoiceStatus?: string
  invoiceNumber?: string
  receivedAt?: string
  paidAt?: string
  paidAmountCents: number
  outstandingAmountCents?: number
  ledgerBalanceEur: number
  carryForwardEur?: number
  statementAmountEur?: number
  payout?: number
}

export const CORRECTABLE_WORKFLOW_STATUSES: ArtistStatementWorkflowStatus[] = [
  'label_approved',
  'artist_notified',
  'viewed',
  'invoiced',
  'acknowledged',
]

export function canCorrectStatement(row: MasterRow): boolean {
  return !!row.statementId && CORRECTABLE_WORKFLOW_STATUSES.includes(row.workflowStatus)
}

export type PaymentMethod = 'sepa' | 'paypal' | 'manual' | 'other'

export const SETTLEMENT_FALLBACK = {
  settlementInvoiceDraft: 'Draft',
  settlementInvoiceSent: 'Sent',
  settlementInvoiceReceived: 'Received',
  settlementInvoicePartial: 'Partially paid',
  settlementInvoicePaid: 'Paid',
  settlementInvoiceCancelled: 'Cancelled',
  settlementPeriodOpen: 'Open',
  settlementPeriodReview: 'Under review',
  settlementPeriodApproved: 'Approved',
  settlementPeriodLocked: 'Locked',
  settlementPeriodArchived: 'Archived',
  settlementHeading: 'Settlement Center',
  settlementDescription: 'Master ledger for drafts, invoices, payments, and period close.',
  settlementSessionExpired: 'Session expired',
  settlementBulkApproveFailed: 'Bulk approval failed',
  settlementApproveFailed: 'Approval failed',
  settlementMarkReceivedFailed: 'Mark as received failed',
  settlementInvoiceMarkFailedFor: 'Could not mark invoice for {artist} as received',
  settlementInvalidAmountFor: 'Invalid amount for {artist}',
  settlementAmountExceedsFor: 'Amount for {artist} exceeds outstanding balance ({amount} EUR)',
  settlementPaymentFailedFor: 'Payment for {artist} failed',
  settlementRecordPaymentFailed: 'Failed to record payment',
  settlementLockFailed: 'Failed to lock period',
  settlementLockFailedToast: 'Lock failed',
  settlementCorrectionInvalidAmount: 'Please enter a valid amount in EUR',
  settlementCorrectionFailed: 'Failed to create correction',
  settlementCorrectionFailedToast: 'Correction failed',
  settlementCorrectionPdfRequired:
    'Upload CSV data first so a correction PDF can be generated for this artist.',
  settlementCorrectionPdfUnavailable: 'Correction PDF generation is not available in this view.',
  settlementArchiveFailed: 'Failed to archive period',
  settlementArchiveFailedToast: 'Archive failed',
  settlementDraftsCreated: '{count} draft(s) created',
  settlementApprovedToast: '{approved} statement(s) approved',
  settlementNotificationsSent: ', {emailed} notification(s) sent',
  settlementInvoicesMarkedReceived: '{count} invoice(s) marked as received',
  settlementPaymentsRecorded: '{count} payment(s) recorded',
  settlementPeriodLockedToast: 'Settlement period locked',
  settlementCorrectionCreated: 'Correction draft created for {artist}. The original statement was replaced.',
  settlementPeriodArchivedToast: 'Period archived; carry-forwards booked to next period',
  settlementCurrentPeriod: 'Current period',
  settlementPeriodAlertTitle: 'Period: {period}',
  settlementPeriodAlertBody:
    'Drafts do not notify artists. Approval sends the portal notification and enables invoice creation.',
  settlementSyncAnalyticsOnApprove: 'Sync portal analytics when approving',
  settlementAnalyticsSyncedOnApprove: 'Portal analytics synced for this period',
  settlementAnalyticsSyncSkipped: 'Portal analytics not synced (no territory metrics)',
  settlementKpiApproved: 'Approved',
  settlementKpiApprovedHint: 'Statements with label approval',
  settlementKpiViewed: 'Viewed',
  settlementKpiViewedHint: 'Opened by artist in portal',
  settlementKpiInvoiced: 'Invoices',
  settlementKpiInvoicedHint: 'Invoices created',
  settlementKpiReceived: 'Received',
  settlementKpiReceivedHint: 'Invoices received at label',
  settlementKpiPaid: 'Paid',
  settlementKpiPaidHint: 'Payments fully recorded',
  settlementOpenBalance: 'Open balance',
  settlementOpenBalanceHint: 'Sum of all open ledger balances',
  settlementReconciliationTitle: 'Ledger balance mismatch',
  settlementReconciliationBody:
    'The register KPI ({reported} EUR) does not match the sum of per-artist ledger balances ({computed} EUR). Delta: {delta} EUR. Review ledger entries before locking the period.',
  settlementApprovalNotesLabel: 'Internal approval notes (optional)',
  settlementApprovalNotesPlaceholder: 'Notes for selected approvals…',
  settlementCreateDrafts: 'Create drafts ({count})',
  settlementApproveNotify: 'Approve & notify ({count})',
  settlementMarkReceived: 'Mark received ({count})',
  settlementRecordPayment: 'Record payment ({count})',
  settlementLockPeriod: 'Lock period',
  settlementArchivePeriod: 'Archive period',
  settlementFilterPlaceholder: 'Filter artists…',
  settlementDeselectAll: 'Clear selection',
  settlementSelectActionable: 'Select actionable rows',
  settlementLoadingRegister: 'Loading settlement register…',
  settlementNoArtistsFilter: 'No artists match the current filter.',
  settlementColViewed: 'Viewed',
  settlementColInvoice: 'Invoice',
  settlementColOpenBalance: 'Open balance',
  settlementColCarryForward: 'Carry-forward',
  settlementColArtist: 'Artist',
  settlementColStatement: 'Statement',
  settlementColReceived: 'Received',
  settlementColPaid: 'Paid',
  settlementColActions: 'Actions',
  settlementSelectArtist: 'Select {artist}',
  settlementSelectActionableAria: 'Select actionable rows',
  settlementDraftBtn: 'Draft',
  settlementApproveBtn: 'Approve',
  settlementCorrectionBtn: 'Correction',
  settlementCorrectionAria: 'Correction for {artist}',
  settlementCorrectionTitle: 'Statement correction',
  settlementCorrectionDesc:
    'Creates a new correction draft and marks the previous statement as replaced. The correction draft must be approved again.',
  settlementPreviousAmount: 'Previous amount:',
  settlementChangeAmount: 'Change:',
  settlementInvoiceExistsWarning:
    'This artist already has an invoice. Review payment and ledger impacts manually after the correction.',
  settlementCorrectedAmountLabel: 'Corrected amount (EUR)',
  settlementCorrectedAmountPlaceholder: 'e.g. 1234.56',
  settlementInternalNoteLabel: 'Internal note (optional)',
  settlementCorrectionReasonPlaceholder: 'Reason for correction…',
  settlementCancel: 'Cancel',
  settlementCreateCorrectionDraft: 'Create correction draft',
  settlementPaymentTitle: 'Record payment',
  settlementPaymentDescSingle: 'Enter amount in EUR for the selected invoice.',
  settlementPaymentDescMulti: 'Enter a separate amount in EUR per invoice ({count} selected).',
  settlementOutstandingSuffix: ' · outstanding {amount} EUR',
  settlementPaymentAmountPlaceholder: 'e.g. 125.00',
  settlementPaymentMethod: 'Payment method',
  settlementPaymentManual: 'Manual',
  settlementPaymentOther: 'Other',
  settlementPaymentReferenceLabel: 'Reference (optional)',
  settlementPaymentReferencePlaceholder: 'Payment reference / transaction ID',
  settlementSavePayment: 'Save payment',
  settlementLockTitle: 'Lock period?',
  settlementLockDesc: 'Locked periods cannot be edited. Statements and invoices remain viewable.',
  settlementLocking: 'Locking…',
  settlementLockConfirm: 'Lock period',
  settlementArchiveTitle: 'Archive period?',
  settlementArchiveDesc:
    'Open balances will be carried forward to the next period. This action cannot be undone.',
  settlementNextPeriodStart: 'Next period start (YYYY-MM-DD)',
  settlementNextPeriodEnd: 'Next period end (YYYY-MM-DD)',
  settlementArchiving: 'Archiving…',
  settlementArchiveConfirm: 'Archive & book carry-forwards',
} as const

export type SettlementLabels = typeof SETTLEMENT_FALLBACK

export function buildInvoiceStatusLabels(t: Record<string, string | undefined>) {
  return {
    draft: t.settlementInvoiceDraft ?? SETTLEMENT_FALLBACK.settlementInvoiceDraft,
    sent: t.settlementInvoiceSent ?? SETTLEMENT_FALLBACK.settlementInvoiceSent,
    received: t.settlementInvoiceReceived ?? SETTLEMENT_FALLBACK.settlementInvoiceReceived,
    partially_paid: t.settlementInvoicePartial ?? SETTLEMENT_FALLBACK.settlementInvoicePartial,
    paid: t.settlementInvoicePaid ?? SETTLEMENT_FALLBACK.settlementInvoicePaid,
    cancelled: t.settlementInvoiceCancelled ?? SETTLEMENT_FALLBACK.settlementInvoiceCancelled,
  }
}

export function buildPeriodStatusLabels(t: Record<string, string | undefined>) {
  return {
    open: t.settlementPeriodOpen ?? SETTLEMENT_FALLBACK.settlementPeriodOpen,
    under_review: t.settlementPeriodReview ?? SETTLEMENT_FALLBACK.settlementPeriodReview,
    approved: t.settlementPeriodApproved ?? SETTLEMENT_FALLBACK.settlementPeriodApproved,
    locked: t.settlementPeriodLocked ?? SETTLEMENT_FALLBACK.settlementPeriodLocked,
    archived: t.settlementPeriodArchived ?? SETTLEMENT_FALLBACK.settlementPeriodArchived,
  }
}

export function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function fmtCents(cents: number) {
  return fmtEur(cents / 100)
}

export function fmtDate(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function computeNextPeriod(periodStart: string, periodEnd: string) {
  const start = new Date(`${periodStart}T00:00:00`)
  const end = new Date(`${periodEnd}T00:00:00`)
  const durationMs = end.getTime() - start.getTime()
  const nextStart = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  const nextEnd = new Date(nextStart.getTime() + durationMs)
  return { start: toIsoDate(nextStart), end: toIsoDate(nextEnd) }
}

export function registerToMasterRow(row: SettlementRegisterRow): MasterRow {
  return {
    artistName: row.artistName,
    artistId: row.artistId,
    workflowStatus: workflowStatusFromStatement(
      row.statementStatus as SalesStatementStatus | undefined,
      true,
    ),
    statementId: row.statementId,
    firstViewedAt: row.firstViewedAt,
    invoiceId: row.invoiceId,
    invoiceStatus: row.invoiceStatus,
    invoiceNumber: row.invoiceNumber,
    receivedAt: row.receivedAt,
    paidAt: row.paidAt,
    paidAmountCents: row.paidAmountCents,
    outstandingAmountCents: row.outstandingAmountCents,
    ledgerBalanceEur: row.ledgerBalanceEur,
    carryForwardEur: row.carryForwardEur,
    statementAmountEur: row.statementAmountEur,
  }
}

export function rowIsSelectable(row: MasterRow) {
  return (
    (row.workflowStatus === 'not_uploaded' && !!row.artistId) ||
    (row.workflowStatus === 'draft' && !!row.statementId) ||
    (!!row.invoiceId && !row.receivedAt && row.invoiceStatus === 'sent') ||
    (!!row.invoiceId && row.invoiceStatus !== 'paid' && row.invoiceStatus !== 'cancelled')
  )
}
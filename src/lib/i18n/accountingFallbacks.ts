import { useMessages } from 'next-intl'
import { useMemo } from 'react'
import type { Dictionary } from '@/i18n/types'

/**
 * English fallback strings for admin accounting and settlement UI.
 * Merged with `admin.accounting` locale messages when translations exist.
 */

export const ACCOUNTING_FALLBACK = {
  pageTitle: 'Accounting',
  pageDescription: 'Generate royalty statements for artists and review statement history.',
  tabGenerate: 'Generate Statements',
  tabHistory: 'Statement History',
  subTabUpload: 'Upload',
  subTabReporting: 'Reporting',
  subTabSettlements: 'Settlement Center',
  subTabAnalytics: 'Portal Data',
  subTabAnalyticsHint:
    'Bronze archives, listener sync, and Save to Portal — data artists will see after you persist it.',
  subTabSettlementsHint:
    'Save portal analytics, create draft statements, approve them, track invoices, and record payments.',
  subTabPayout: 'SEPA Payout',
  subTabTrends: 'Trends',
  subTabRules: 'Rules',
  presets: 'Presets',
  presetsTitle: 'Rule Presets',
  csvProfiles: 'CSV Profiles',
  csvProfilesTitle: 'CSV Import Profiles',
  workspace: 'Workspace',
  workspaceTitle: 'Workspace Import / Export',
  pdfSettings: 'PDF Settings',
  detectedPeriod: 'Detected period:',
  processing: '(processing…)',
  emptyReporting: 'Upload CSV files first to see reporting data.',
  emptySettlements: 'Upload CSV files first to open the settlement center.',
  emptyAnalytics: 'Upload CSV files first to see analytics.',
  emptyPayout: 'Upload CSV files first to calculate payouts.',
  analyticsOpsHeading: 'Portal data & operations',
  analyticsPreviewHeading: 'Session preview (not in portal)',
  analyticsSessionBanner:
    'Charts below use in-memory CSV data. Artists only see metrics after you click Save to Portal.',
  workspaceServer: 'Workspace (server):',
  workspaceNotSaved: 'not yet saved for this period',
  workspaceLastSaved: 'last saved',
  workspaceReload: 'Reload from server',
  workspaceReloadConfirmTitle: 'Reload from server?',
  workspaceReloadConfirmBody:
    'Unsaved changes in this browser will be replaced by the server copy.',
  workspaceReloadConfirm: 'Reload',
  workspaceSave: 'Save workspace to server',
  workspaceSharedHint: 'Shared across team • period-keyed',
  workspaceLoading: 'Loading…',
  workspaceSaving: 'Saving…',
  playbookTitle: 'Operator playbook',
  playbookStep1: 'Upload CSV files and approve statements in Settlement Center.',
  playbookStep2: 'Use Save to Portal in Settlement Center so artists see analytics with their statements.',
  playbookStep3: 'Review saved trends and roster health in Label Intelligence.',
  subTabListLabel: 'Accounting workflow sections',
  rulesWorkspaceSynced: 'Rules synced to server workspace',
  rulesWorkspaceDirty: 'Unsaved rule changes — saving to server…',
  rulesWorkspaceDefaultSynced: 'Settings synced to server (Default preset)',
  workspaceDefaultSaved: 'Default preset saved',
  workspaceDefaultNotSaved: 'Default preset not saved yet',
  workspaceSaveDefault: 'Save default preset',
  workspaceDefaultHint: 'Shared default settings until a period is detected',
  workspaceSaveSuccess: 'Accounting workspace saved to server',
  workspaceDefaultSaveSuccess: 'Default accounting settings saved to server',
  workspaceSaveFailed: 'Save failed',
  workspaceSaveError: 'Failed to save workspace',
  workspaceDefaultSaveError: 'Failed to save default preset',
  workspaceLoadFailed: 'Failed to load workspace from server',
  presetDeleteDefaultBlocked: 'The Default preset cannot be deleted',
  rulesWorkspaceSaving: 'Saving rules to server…',
  guidedModeLabel: 'Guided',
  advancedModeLabel: 'Advanced',
  guidedSwitchAdvanced: 'Switch to advanced mode',
  guidedSwitchGuided: 'Switch to guided mode',
  guidedStepUpload: 'Upload',
  guidedStepUploadDesc: 'Import distributor CSV files',
  guidedStepReview: 'Review',
  guidedStepReviewDesc: 'Validate payouts before publishing',
  guidedStepSettle: 'Publish',
  guidedStepSettleDesc: 'Save analytics, create drafts, and approve',
  guidedBack: 'Back',
  guidedNext: 'Continue',
  guidedOpenSettle: 'Open settlement',
  guidedProcessingHint: 'Processing CSV data…',
  guidedUploadHint: 'Upload at least one distributor CSV to continue.',
  guidedReviewHint: 'Check artist payouts, then continue to publish statements.',
  guidedSettleHint: 'Save portal analytics and run the settlement workflow below.',
  guidedStepperAria: 'Accounting guided workflow',
  bronzeLoading: 'Loading Bronze archives…',
  bronzeArchiveLoadError: 'Failed to load bronze archive',
  bronzeLoadUnavailable: 'Load is not available in this context',
  currencyFallbackTitle: 'Fallback exchange rates in use',
  currencyFallbackDescription:
    'ECB rates could not be loaded. Currency conversions may be inaccurate — review before publishing statements.',
  currencyRefreshSuccess: 'Exchange rates updated successfully',
  presetSaveHeading: 'Save Current Rules',
  presetNamePlaceholder: 'Preset name, e.g. Q1-2025',
  presetSaveButton: 'Save',
  presetRulesLoaded: '{count} rules loaded',
  presetEmpty: 'No presets saved yet.',
  presetSavedList: 'Saved Presets ({count})',
  presetRulesCount: '{count} rules · saved {date}',
  presetLoaded: 'Loaded',
  presetLoadButton: 'Load',
  presetDeleteTitle: 'Delete Preset',
  presetDeleteConfirm: 'Are you sure you want to delete "{name}"? This cannot be undone.',
  presetDeleteCancel: 'Cancel',
  presetDeleteButton: 'Delete',
  presetMigratedToast: 'Migrated {count} preset(s) from local storage to the server',
  sourceMixSubtitle: 'SOS session — distributor view (in-memory CSV data)',
} as const

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
  settlementRegisterLoadFailed: 'Failed to load settlement register',
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
  settlementColSessionPayout: 'Session payout',
  settlementColStatementAmount: 'Statement amount',
  settlementDeleteDraftBtn: 'Delete draft',
  settlementDeleteDraftSuccess: 'Draft deleted for {artist}',
  settlementDeleteDraftFailed: 'Failed to delete draft for {artist}',
  settlementDeleteDraftConfirm: 'Delete draft statement for {artist}? This cannot be undone.',
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

export type AccountingFallbackLabels = typeof ACCOUNTING_FALLBACK
export type SettlementFallbackLabels = typeof SETTLEMENT_FALLBACK

export type AccountingLabelKey =
  | keyof AccountingFallbackLabels
  | keyof SettlementFallbackLabels

/** Merged accounting + settlement labels (locale values are plain strings). */
export type AccountingLabels = Record<AccountingLabelKey, string>

export type AccountingLabelOverrides = Partial<AccountingLabels>

/**
 * Merges locale dictionary overrides onto English fallbacks.
 * @param overrides - Partial labels from `admin.accounting` messages
 */
export function mergeAccountingLabels(
  overrides?: AccountingLabelOverrides,
): AccountingLabels {
  return { ...ACCOUNTING_FALLBACK, ...SETTLEMENT_FALLBACK, ...overrides }
}

export type AccountingMessages = Dictionary['admin']['accounting']

/** Locale `admin.accounting` slice from next-intl messages (for fallback merges). */
export function useAccountingMessages(): Partial<AccountingMessages> | undefined {
  const messages = useMessages() as Dictionary
  return messages.admin?.accounting
}

export function useAccountingLabels(): AccountingLabels {
  const overrides = useAccountingMessages()
  return useMemo(() => mergeAccountingLabels(overrides), [overrides])
}

export function useMergedAccountingLabels<T extends Record<string, string>>(
  fallback: T,
): T & AccountingLabelOverrides {
  const overrides = useAccountingMessages()
  return useMemo(() => ({ ...fallback, ...overrides }), [fallback, overrides]) as T & AccountingLabelOverrides
}
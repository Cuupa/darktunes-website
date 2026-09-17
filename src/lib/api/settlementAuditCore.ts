/**
 * Pure detector core for the SOS settlement data audit (§E.3).
 *
 * Read-only by construction: every function takes plain row snapshots and
 * returns findings. No Supabase client, no R2, no writes.
 */

export const AUDIT_CATEGORIES = [
  'period_link',
  'artist_mismatch',
  'invoice_without_pdf',
  'pdf_without_record',
  'unconfirmed_import_batch',
  'artifact_integrity',
  'duplicate_operation',
  'carry_forward_integrity',
  'balance_mismatch',
  'missing_evidence',
] as const
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]

export const AUDIT_SEVERITIES = ['error', 'warning', 'info'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number]

export const AUDIT_REPAIRABILITIES = ['unique', 'ambiguous', 'not_repairable'] as const
export type AuditRepairability = (typeof AUDIT_REPAIRABILITIES)[number]

export type AuditEntityType =
  | 'sales_statement'
  | 'artist_invoice'
  | 'artist_settlement_ledger'
  | 'period_carry_forward'
  | 'distributor_import_batch'
  | 'settlement_operation'
  | 'r2_object'

export interface SettlementPeriodSnapshot {
  id: string
  label: string
  periodStart: string
  periodEnd: string
  status: string
}

export interface StatementSnapshot {
  id: string
  artistId: string
  settlementPeriodId: string | null
  periodStart: string | null
  periodEnd: string | null
  status: string
  isArchived: boolean
  amountEur: number
  firstViewedAt: string | null
  createdAt: string
}

export interface InvoiceSnapshot {
  id: string
  artistId: string
  statementId: string | null
  status: string
  settlementPeriodId: string | null
  servicePeriodStart: string | null
  servicePeriodEnd: string | null
  pdfUrl: string | null
  pdfSha256: string | null
  deliveryStatus: string
  deliveryAttemptedAt: string | null
  paidAmountCents: number | null
  outstandingAmountCents: number | null
  updatedAt: string
}

export interface LedgerEntrySnapshot {
  id: string
  artistId: string
  settlementPeriodId: string | null
  entryType: string
  amountEur: number
  referenceType: string | null
  referenceId: string | null
  createdAt: string
}

export interface CarryForwardSnapshot {
  id: string
  fromPeriodId: string
  toPeriodId: string | null
  artistId: string
  openingBalanceEur: number
  appliedAt: string | null
  createdAt: string
}

export interface ImportBatchSnapshot {
  id: string
  status: string
  fileHash: string | null
  periodStart: string
  periodEnd: string
  createdAt: string
}

export interface SettlementOperationSnapshot {
  id: string
  operationType: string
  resourceType: string
  resourceId: string
  status: string
  payloadHash: string
  createdAt: string
}

export interface ArtifactCheck {
  entityType: Extract<
    AuditEntityType,
    'sales_statement' | 'artist_invoice' | 'distributor_import_batch'
  >
  entityId: string
  objectKey: string
  expectedSha256: string
  actualSha256: string | null
  expectedSizeBytes?: number | null
  actualSizeBytes?: number | null
}

export interface SettlementAuditInput {
  periods: SettlementPeriodSnapshot[]
  statements: StatementSnapshot[]
  invoices: InvoiceSnapshot[]
  ledgerEntries: LedgerEntrySnapshot[]
  carryForwards: CarryForwardSnapshot[]
  importBatches: ImportBatchSnapshot[]
  operations: SettlementOperationSnapshot[]
  artifactChecks?: ArtifactCheck[]
  orphanPdfObjectKeys?: string[]
  categories?: AuditCategory[]
  scopePeriodId?: string | null
  generatedAt?: string
  truncated?: boolean
}

export type AuditEvidenceValue = string | number | boolean | null

export interface AuditFinding {
  /** Stable identity: category + entity + discriminator. */
  id: string
  category: AuditCategory
  severity: AuditSeverity
  entityType: AuditEntityType
  entityId: string
  summary: string
  evidence: Record<string, AuditEvidenceValue>
  /** Preconditions/values a repair would need; null when the case is not repairable. */
  expectedState: Record<string, AuditEvidenceValue> | null
  suggestedAction: string
  repairability: AuditRepairability
}

export interface SettlementAuditReport {
  generatedAt: string
  scope: { periodId: string | null }
  truncated: boolean
  summary: {
    findings: number
    byCategory: Record<AuditCategory, number>
    bySeverity: Record<AuditSeverity, number>
    byRepairability: Record<AuditRepairability, number>
  }
  findings: AuditFinding[]
}

const BALANCE_TOLERANCE_EUR = 0.005
const PDF_REQUIRED_INVOICE_STATUSES = ['sent', 'received', 'partially_paid', 'paid']
const VIEW_EVIDENCE_STATEMENT_STATUSES = ['viewed', 'invoiced', 'paid']
const DUPLICATE_GUARDED_LEDGER_TYPES = [
  'statement_payout',
  'invoice_liability',
  'carry_in',
  'carry_out',
] as const

interface FindingInput {
  category: AuditCategory
  severity: AuditSeverity
  entityType: AuditEntityType
  entityId: string
  summary: string
  evidence?: Record<string, AuditEvidenceValue>
  expectedState?: Record<string, AuditEvidenceValue> | null
  suggestedAction: string
  repairability: AuditRepairability
  discriminator?: string
}

function finding(input: FindingInput): AuditFinding {
  return {
    id: [
      input.category,
      input.entityType,
      input.entityId,
      input.discriminator,
    ]
      .filter(Boolean)
      .join(':'),
    category: input.category,
    severity: input.severity,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    evidence: input.evidence ?? {},
    expectedState: input.expectedState ?? null,
    suggestedAction: input.suggestedAction,
    repairability: input.repairability,
  }
}

function emptyCategoryCounts(): Record<AuditCategory, number> {
  return Object.fromEntries(AUDIT_CATEGORIES.map((category) => [category, 0])) as Record<
    AuditCategory,
    number
  >
}

function emptySeverityCounts(): Record<AuditSeverity, number> {
  return Object.fromEntries(AUDIT_SEVERITIES.map((severity) => [severity, 0])) as Record<
    AuditSeverity,
    number
  >
}

function emptyRepairabilityCounts(): Record<AuditRepairability, number> {
  return Object.fromEntries(
    AUDIT_REPAIRABILITIES.map((repairability) => [repairability, 0]),
  ) as Record<AuditRepairability, number>
}

function matchingPeriods(
  periods: SettlementPeriodSnapshot[],
  start: string | null,
  end: string | null,
): SettlementPeriodSnapshot[] {
  if (!start || !end) return []
  return periods.filter((period) => period.periodStart === start && period.periodEnd === end)
}

function auditPeriodLink(
  input: SettlementAuditInput,
  findings: AuditFinding[],
): void {
  const periodById = new Map(input.periods.map((period) => [period.id, period]))

  for (const statement of input.statements) {
    if (!statement.settlementPeriodId) {
      const matches = matchingPeriods(input.periods, statement.periodStart, statement.periodEnd)
      findings.push(
        finding({
          category: 'period_link',
          severity: 'warning',
          entityType: 'sales_statement',
          entityId: statement.id,
          summary: 'Statement has no settlement period link',
          evidence: {
            settlement_period_id: statement.settlementPeriodId,
            period_start: statement.periodStart,
            period_end: statement.periodEnd,
            status: statement.status,
          },
          expectedState:
            matches.length === 1 ? { settlement_period_id: matches[0].id } : null,
          suggestedAction:
            matches.length === 1
              ? 'Link to the settlement period with exactly matching bounds'
              : 'Assign the settlement period manually',
          repairability: matches.length === 1 ? 'unique' : 'ambiguous',
        }),
      )
      continue
    }

    const period = periodById.get(statement.settlementPeriodId)
    if (!period) {
      const matches = matchingPeriods(input.periods, statement.periodStart, statement.periodEnd)
      findings.push(
        finding({
          category: 'period_link',
          severity: 'error',
          entityType: 'sales_statement',
          entityId: statement.id,
          summary: 'Statement links to a settlement period that does not exist',
          evidence: { settlement_period_id: statement.settlementPeriodId },
          expectedState:
            matches.length === 1 ? { settlement_period_id: matches[0].id } : null,
          suggestedAction:
            matches.length === 1
              ? 'Relink to the settlement period with exactly matching bounds'
              : 'Inspect the deleted period and decide manually',
          repairability: matches.length === 1 ? 'unique' : 'ambiguous',
        }),
      )
      continue
    }

    if (
      statement.periodStart &&
      statement.periodEnd &&
      (statement.periodStart !== period.periodStart || statement.periodEnd !== period.periodEnd)
    ) {
      findings.push(
        finding({
          category: 'period_link',
          severity: 'warning',
          entityType: 'sales_statement',
          entityId: statement.id,
          summary: 'Statement dates differ from its settlement period bounds',
          evidence: {
            statement_start: statement.periodStart,
            statement_end: statement.periodEnd,
            period_start: period.periodStart,
            period_end: period.periodEnd,
          },
          suggestedAction: 'Check whether the statement belongs to another period',
          repairability: 'not_repairable',
        }),
      )
    }

    if (period.status === 'archived' && !statement.isArchived) {
      findings.push(
        finding({
          category: 'period_link',
          severity: 'warning',
          entityType: 'sales_statement',
          entityId: statement.id,
          summary: 'Statement is not marked archived although its settlement period is archived',
          evidence: {
            is_archived: statement.isArchived,
            period_status: period.status,
            settlement_period_id: period.id,
          },
          expectedState: { is_archived: true },
          suggestedAction: 'Mark the statement archived to match its archived settlement period',
          repairability: 'unique',
        }),
      )
    }
  }

  for (const invoice of input.invoices) {
    if (!invoice.settlementPeriodId) {
      const matches = matchingPeriods(
        input.periods,
        invoice.servicePeriodStart,
        invoice.servicePeriodEnd,
      )
      findings.push(
        finding({
          category: 'period_link',
          severity: 'warning',
          entityType: 'artist_invoice',
          entityId: invoice.id,
          summary: 'Invoice has no settlement period link',
          evidence: {
            settlement_period_id: invoice.settlementPeriodId,
            service_period_start: invoice.servicePeriodStart,
            service_period_end: invoice.servicePeriodEnd,
            status: invoice.status,
          },
          expectedState:
            matches.length === 1 ? { settlement_period_id: matches[0].id } : null,
          suggestedAction:
            matches.length === 1
              ? 'Link to the settlement period with exactly matching bounds'
              : 'Assign the settlement period manually',
          repairability: matches.length === 1 ? 'unique' : 'ambiguous',
        }),
      )
      continue
    }

    if (!periodById.has(invoice.settlementPeriodId)) {
      findings.push(
        finding({
          category: 'period_link',
          severity: 'error',
          entityType: 'artist_invoice',
          entityId: invoice.id,
          summary: 'Invoice links to a settlement period that does not exist',
          evidence: { settlement_period_id: invoice.settlementPeriodId },
          suggestedAction: 'Inspect the deleted period and decide manually',
          repairability: 'not_repairable',
        }),
      )
    }
  }

  for (const entry of input.ledgerEntries) {
    if (!entry.settlementPeriodId) {
      findings.push(
        finding({
          category: 'period_link',
          severity: 'warning',
          entityType: 'artist_settlement_ledger',
          entityId: entry.id,
          summary: 'Ledger entry has no settlement period link',
          evidence: { entry_type: entry.entryType, reference_type: entry.referenceType },
          suggestedAction: 'Derive the period from the referenced document and relink manually',
          repairability: 'ambiguous',
        }),
      )
    } else if (!periodById.has(entry.settlementPeriodId)) {
      findings.push(
        finding({
          category: 'period_link',
          severity: 'error',
          entityType: 'artist_settlement_ledger',
          entityId: entry.id,
          summary: 'Ledger entry links to a settlement period that does not exist',
          evidence: { settlement_period_id: entry.settlementPeriodId },
          suggestedAction: 'Inspect the deleted period and decide manually',
          repairability: 'not_repairable',
        }),
      )
    }
  }
}

function auditArtistMismatch(input: SettlementAuditInput, findings: AuditFinding[]): void {
  const statementById = new Map(input.statements.map((statement) => [statement.id, statement]))

  for (const invoice of input.invoices) {
    if (!invoice.statementId) continue
    const statement = statementById.get(invoice.statementId)
    if (!statement) {
      findings.push(
        finding({
          category: 'artist_mismatch',
          severity: 'error',
          entityType: 'artist_invoice',
          entityId: invoice.id,
          summary: 'Invoice references a statement that was not found',
          evidence: { statement_id: invoice.statementId },
          suggestedAction: 'Inspect the statement reference manually',
          repairability: 'not_repairable',
        }),
      )
      continue
    }

    if (statement.artistId !== invoice.artistId) {
      findings.push(
        finding({
          category: 'artist_mismatch',
          severity: 'error',
          entityType: 'artist_invoice',
          entityId: invoice.id,
          summary: 'Invoice and linked statement belong to different artists',
          evidence: {
            invoice_artist_id: invoice.artistId,
            statement_artist_id: statement.artistId,
            statement_id: statement.id,
          },
          suggestedAction: 'Resolve the artist assignment manually before any document action',
          repairability: 'not_repairable',
        }),
      )
    }
  }
}

function auditInvoicesWithoutPdf(input: SettlementAuditInput, findings: AuditFinding[]): void {
  for (const invoice of input.invoices) {
    if (!PDF_REQUIRED_INVOICE_STATUSES.includes(invoice.status)) continue
    if (invoice.pdfUrl && invoice.pdfSha256) continue

    findings.push(
      finding({
        category: 'invoice_without_pdf',
        severity: 'error',
        entityType: 'artist_invoice',
        entityId: invoice.id,
        summary: 'Invoice reached a sent/paid state without a stored PDF',
        evidence: {
          status: invoice.status,
          has_pdf_url: Boolean(invoice.pdfUrl),
          has_pdf_sha256: Boolean(invoice.pdfSha256),
        },
        suggestedAction: 'Rebuild the PDF from the persisted invoice row and store its hash',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditPdfWithoutRecord(input: SettlementAuditInput, findings: AuditFinding[]): void {
  for (const objectKey of input.orphanPdfObjectKeys ?? []) {
    findings.push(
      finding({
        category: 'pdf_without_record',
        severity: 'warning',
        entityType: 'r2_object',
        entityId: objectKey,
        summary: 'Stored invoice PDF has no matching invoice row',
        evidence: { object_key: objectKey },
        suggestedAction: 'Verify whether the row was deleted intentionally; do not mass-delete',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditUnconfirmedBatches(input: SettlementAuditInput, findings: AuditFinding[]): void {
  for (const batch of input.importBatches) {
    if (batch.status === 'completed') continue
    findings.push(
      finding({
        category: 'unconfirmed_import_batch',
        severity: 'warning',
        entityType: 'distributor_import_batch',
        entityId: batch.id,
        summary: 'Import batch is not confirmed',
        evidence: {
          status: batch.status,
          has_file_hash: Boolean(batch.fileHash),
          period_start: batch.periodStart,
          period_end: batch.periodEnd,
        },
        suggestedAction: 'Confirm the upload, retry the hash check or mark the batch failed',
        repairability: 'ambiguous',
      }),
    )
  }
}

function auditArtifactIntegrity(input: SettlementAuditInput, findings: AuditFinding[]): void {
  for (const check of input.artifactChecks ?? []) {
    const hashMismatch =
      check.actualSha256 === null || check.actualSha256 !== check.expectedSha256
    const sizeMismatch =
      check.expectedSizeBytes != null &&
      check.actualSizeBytes != null &&
      check.expectedSizeBytes !== check.actualSizeBytes
    if (!hashMismatch && !sizeMismatch) continue

    findings.push(
      finding({
        category: 'artifact_integrity',
        severity: 'error',
        entityType: check.entityType,
        entityId: check.entityId,
        summary: 'Stored artifact hash or size does not match the recorded value',
        evidence: {
          object_key: check.objectKey,
          expected_sha256: check.expectedSha256,
          actual_sha256: check.actualSha256,
          expected_size_bytes: check.expectedSizeBytes ?? null,
          actual_size_bytes: check.actualSizeBytes ?? null,
        },
        suggestedAction: 'Restore the artifact from backup and re-verify the hash',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditDuplicateOperations(input: SettlementAuditInput, findings: AuditFinding[]): void {
  const ledgerGroups = new Map<string, LedgerEntrySnapshot[]>()
  for (const entry of input.ledgerEntries) {
    if (!(DUPLICATE_GUARDED_LEDGER_TYPES as readonly string[]).includes(entry.entryType)) continue
    const key = `${entry.entryType}|${entry.referenceId ?? ''}`
    const group = ledgerGroups.get(key) ?? []
    group.push(entry)
    ledgerGroups.set(key, group)
  }

  for (const [key, group] of ledgerGroups) {
    if (group.length < 2) continue
    const [entryType, referenceId] = key.split('|')
    findings.push(
      finding({
        category: 'duplicate_operation',
        severity: 'error',
        entityType: 'artist_settlement_ledger',
        entityId: group[0].id,
        discriminator: referenceId || entryType,
        summary: `Multiple ${entryType} ledger entries share one reference`,
        evidence: {
          entry_type: entryType,
          reference_id: referenceId || null,
          count: group.length,
          entry_ids: group.map((entry) => entry.id).join(','),
        },
        suggestedAction: 'Inspect and reverse the duplicated booking manually',
        repairability: 'not_repairable',
      }),
    )
  }

  const invoicesByStatement = new Map<string, InvoiceSnapshot[]>()
  for (const invoice of input.invoices) {
    if (!invoice.statementId) continue
    const group = invoicesByStatement.get(invoice.statementId) ?? []
    group.push(invoice)
    invoicesByStatement.set(invoice.statementId, group)
  }
  for (const [statementId, group] of invoicesByStatement) {
    if (group.length < 2) continue
    findings.push(
      finding({
        category: 'duplicate_operation',
        severity: 'error',
        entityType: 'artist_invoice',
        entityId: group[0].id,
        discriminator: statementId,
        summary: 'Multiple invoices exist for one statement',
        evidence: {
          statement_id: statementId,
          count: group.length,
          invoice_ids: group.map((invoice) => invoice.id).join(','),
        },
        suggestedAction: 'Decide manually which invoice is authoritative; never delete blindly',
        repairability: 'not_repairable',
      }),
    )
  }

  const operationGroups = new Map<string, SettlementOperationSnapshot[]>()
  for (const operation of input.operations) {
    const key = `${operation.operationType}|${operation.resourceType}|${operation.resourceId}`
    const group = operationGroups.get(key) ?? []
    group.push(operation)
    operationGroups.set(key, group)
  }
  for (const [key, group] of operationGroups) {
    const distinctHashes = new Set(group.map((operation) => operation.payloadHash))
    if (distinctHashes.size < 2) continue
    const [operationType, resourceType, resourceId] = key.split('|')
    findings.push(
      finding({
        category: 'duplicate_operation',
        severity: 'warning',
        entityType: 'settlement_operation',
        entityId: group[0].id,
        discriminator: resourceId,
        summary: 'Operation journal holds conflicting payloads for one resource',
        evidence: {
          operation_type: operationType,
          resource_type: resourceType,
          resource_id: resourceId,
          payload_hashes: group.length,
        },
        suggestedAction: 'Inspect the operation journal entries and reconcile manually',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditCarryForwardIntegrity(
  input: SettlementAuditInput,
  findings: AuditFinding[],
): void {
  const carryInByPeriodArtist = new Map<string, LedgerEntrySnapshot[]>()
  for (const entry of input.ledgerEntries) {
    if (entry.entryType !== 'carry_in') continue
    const key = `${entry.settlementPeriodId ?? ''}|${entry.artistId}`
    const group = carryInByPeriodArtist.get(key) ?? []
    group.push(entry)
    carryInByPeriodArtist.set(key, group)
  }

  const periodById = new Map(input.periods.map((period) => [period.id, period]))

  for (const carry of input.carryForwards) {
    const key = `${carry.toPeriodId ?? ''}|${carry.artistId}`
    const carryIns = carryInByPeriodArtist.get(key) ?? []

    if (carry.appliedAt && carry.toPeriodId) {
      if (carryIns.length === 0) {
        findings.push(
          finding({
            category: 'carry_forward_integrity',
            severity: 'error',
            entityType: 'period_carry_forward',
            entityId: carry.id,
            summary: 'Applied carry-forward has no carry_in ledger entry',
            evidence: {
              from_period_id: carry.fromPeriodId,
              to_period_id: carry.toPeriodId,
              artist_id: carry.artistId,
              opening_balance_eur: carry.openingBalanceEur,
              applied_at: carry.appliedAt,
            },
            expectedState: {
              ledger_entry_type: 'carry_in',
              settlement_period_id: carry.toPeriodId,
              artist_id: carry.artistId,
              amount_eur: carry.openingBalanceEur,
              reference_type: 'settlement_period',
              reference_id: carry.fromPeriodId,
            },
            suggestedAction: 'Insert the missing carry_in ledger entry from the applied carry-forward',
            repairability: 'unique',
          }),
        )
      } else if (carryIns.length > 1) {
        findings.push(
          finding({
            category: 'carry_forward_integrity',
            severity: 'error',
            entityType: 'period_carry_forward',
            entityId: carry.id,
            summary: 'Multiple carry_in ledger entries exist for one applied carry-forward',
            evidence: {
              to_period_id: carry.toPeriodId,
              artist_id: carry.artistId,
              count: carryIns.length,
              entry_ids: carryIns.map((entry) => entry.id).join(','),
            },
            suggestedAction: 'Reverse the duplicate carry_in manually; never auto-delete bookings',
            repairability: 'not_repairable',
          }),
        )
      }
      continue
    }

    if (carry.appliedAt && !carry.toPeriodId) {
      findings.push(
        finding({
          category: 'carry_forward_integrity',
          severity: 'warning',
          entityType: 'period_carry_forward',
          entityId: carry.id,
          summary: 'Carry-forward is applied but has no target period',
          evidence: { from_period_id: carry.fromPeriodId, artist_id: carry.artistId },
          suggestedAction: 'Assign the target period manually before closing the follow-up period',
          repairability: 'ambiguous',
        }),
      )
      continue
    }

    const fromPeriod = periodById.get(carry.fromPeriodId)
    if (fromPeriod?.status === 'archived') {
      findings.push(
        finding({
          category: 'carry_forward_integrity',
          severity: 'warning',
          entityType: 'period_carry_forward',
          entityId: carry.id,
          summary: 'Archived period has an unapplied carry-forward',
          evidence: {
            from_period_id: carry.fromPeriodId,
            artist_id: carry.artistId,
            opening_balance_eur: carry.openingBalanceEur,
          },
          suggestedAction: 'Apply the carry-forward through the settlement close flow',
          repairability: 'ambiguous',
        }),
      )
    }
  }

  for (const [key, group] of carryInByPeriodArtist) {
    if (group.length < 2) continue
    const [periodId, artistId] = key.split('|')
    const matchingCarry = input.carryForwards.find(
      (carry) => carry.toPeriodId === periodId && carry.artistId === artistId,
    )
    if (matchingCarry) continue

    findings.push(
      finding({
        category: 'carry_forward_integrity',
        severity: 'error',
        entityType: 'artist_settlement_ledger',
        entityId: group[0].id,
        discriminator: `${periodId}|${artistId}`,
        summary: 'Multiple carry_in ledger entries without a matching carry-forward',
        evidence: {
          settlement_period_id: periodId,
          artist_id: artistId,
          count: group.length,
          entry_ids: group.map((entry) => entry.id).join(','),
        },
        suggestedAction: 'Inspect the duplicated carry_in manually',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditBalanceMismatch(input: SettlementAuditInput, findings: AuditFinding[]): void {
  const ledgerByReference = new Map<string, LedgerEntrySnapshot[]>()
  for (const entry of input.ledgerEntries) {
    if (!entry.referenceId) continue
    const group = ledgerByReference.get(entry.referenceId) ?? []
    group.push(entry)
    ledgerByReference.set(entry.referenceId, group)
  }

  for (const statement of input.statements) {
    const payouts = (ledgerByReference.get(statement.id) ?? []).filter(
      (entry) => entry.entryType === 'statement_payout',
    )
    if (payouts.length === 0) continue
    const payoutSum = payouts.reduce((sum, entry) => sum + entry.amountEur, 0)
    if (Math.abs(payoutSum - statement.amountEur) <= BALANCE_TOLERANCE_EUR) continue

    findings.push(
      finding({
        category: 'balance_mismatch',
        severity: 'error',
        entityType: 'sales_statement',
        entityId: statement.id,
        summary: 'Statement amount and booked statement_payout differ',
        evidence: {
          statement_amount_eur: statement.amountEur,
          ledger_payout_eur: payoutSum,
          delta_eur: payoutSum - statement.amountEur,
        },
        suggestedAction: 'Reconcile the booking manually before any payment action',
        repairability: 'not_repairable',
      }),
    )
  }

  for (const invoice of input.invoices) {
    const entries = ledgerByReference.get(invoice.id) ?? []
    const payments = entries.filter(
      (entry) => entry.entryType === 'payment' || entry.entryType === 'partial_payment',
    )
    const paidEur = (invoice.paidAmountCents ?? 0) / 100
    const paymentSum = payments.reduce((sum, entry) => sum + entry.amountEur, 0)

    if (payments.length > 0 && Math.abs(paymentSum + paidEur) > BALANCE_TOLERANCE_EUR) {
      findings.push(
        finding({
          category: 'balance_mismatch',
          severity: 'error',
          entityType: 'artist_invoice',
          entityId: invoice.id,
          summary: 'Invoice paid amount and booked payments differ',
          evidence: {
            invoice_paid_eur: paidEur,
            ledger_payment_eur: paymentSum,
            delta_eur: paymentSum + paidEur,
          },
          suggestedAction: 'Reconcile the payment booking manually',
          repairability: 'not_repairable',
        }),
      )
    }

    const liabilities = entries.filter((entry) => entry.entryType === 'invoice_liability')
    if (liabilities.length === 0 || invoice.outstandingAmountCents == null) continue
    const liabilitySum = liabilities.reduce((sum, entry) => sum + entry.amountEur, 0)
    // Liability and payments are booked negative; outstanding = |liability| - |payments|.
    const expectedOutstandingEur = -liabilitySum + paymentSum
    const outstandingEur = invoice.outstandingAmountCents / 100
    if (Math.abs(expectedOutstandingEur - outstandingEur) <= BALANCE_TOLERANCE_EUR) continue

    findings.push(
      finding({
        category: 'balance_mismatch',
        severity: 'warning',
        entityType: 'artist_invoice',
        entityId: invoice.id,
        summary: 'Invoice outstanding amount and ledger balance differ',
        evidence: {
          outstanding_eur: outstandingEur,
          expected_outstanding_eur: expectedOutstandingEur,
          delta_eur: expectedOutstandingEur - outstandingEur,
        },
        suggestedAction: 'Check liability, payments and outstanding amount together',
        repairability: 'not_repairable',
      }),
    )
  }
}

function auditMissingEvidence(input: SettlementAuditInput, findings: AuditFinding[]): void {
  for (const statement of input.statements) {
    if (!VIEW_EVIDENCE_STATEMENT_STATUSES.includes(statement.status)) continue
    if (statement.firstViewedAt) continue

    findings.push(
      finding({
        category: 'missing_evidence',
        severity: 'warning',
        entityType: 'sales_statement',
        entityId: statement.id,
        summary: 'Statement status implies a view but no view timestamp exists',
        evidence: { status: statement.status },
        suggestedAction: 'Verify the portal view manually; never invent a past timestamp',
        repairability: 'not_repairable',
      }),
    )
  }

  for (const invoice of input.invoices) {
    if (!PDF_REQUIRED_INVOICE_STATUSES.includes(invoice.status)) continue
    if (invoice.deliveryStatus === 'sent') continue

    findings.push(
      finding({
        category: 'missing_evidence',
        severity: 'warning',
        entityType: 'artist_invoice',
        entityId: invoice.id,
        summary: 'Invoice status implies delivery but no confirmed mail evidence exists',
        evidence: {
          status: invoice.status,
          delivery_status: invoice.deliveryStatus,
          delivery_attempted_at: invoice.deliveryAttemptedAt,
        },
        suggestedAction: 'Re-send through the invoice flow or correct the delivery state manually',
        repairability: 'not_repairable',
      }),
    )
  }
}

const CATEGORY_ORDER = new Map(AUDIT_CATEGORIES.map((category, index) => [category, index]))
const SEVERITY_ORDER = new Map(AUDIT_SEVERITIES.map((severity, index) => [severity, index]))

export function buildSettlementAuditReport(
  input: SettlementAuditInput,
): SettlementAuditReport {
  const findings: AuditFinding[] = []

  auditPeriodLink(input, findings)
  auditArtistMismatch(input, findings)
  auditInvoicesWithoutPdf(input, findings)
  auditPdfWithoutRecord(input, findings)
  auditUnconfirmedBatches(input, findings)
  auditArtifactIntegrity(input, findings)
  auditDuplicateOperations(input, findings)
  auditCarryForwardIntegrity(input, findings)
  auditBalanceMismatch(input, findings)
  auditMissingEvidence(input, findings)

  findings.sort((a, b) => {
    const categoryDelta =
      (CATEGORY_ORDER.get(a.category) ?? 0) - (CATEGORY_ORDER.get(b.category) ?? 0)
    if (categoryDelta !== 0) return categoryDelta
    const severityDelta =
      (SEVERITY_ORDER.get(a.severity) ?? 0) - (SEVERITY_ORDER.get(b.severity) ?? 0)
    if (severityDelta !== 0) return severityDelta
    const entityDelta = a.entityType.localeCompare(b.entityType)
    if (entityDelta !== 0) return entityDelta
    return a.id.localeCompare(b.id)
  })

  const categoryFilter = input.categories ? new Set(input.categories) : null
  const selectedFindings = categoryFilter
    ? findings.filter((item) => categoryFilter.has(item.category))
    : findings

  const byCategory = emptyCategoryCounts()
  const bySeverity = emptySeverityCounts()
  const byRepairability = emptyRepairabilityCounts()
  for (const item of selectedFindings) {
    byCategory[item.category] += 1
    bySeverity[item.severity] += 1
    byRepairability[item.repairability] += 1
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: { periodId: input.scopePeriodId ?? null },
    truncated: input.truncated ?? false,
    summary: {
      findings: selectedFindings.length,
      byCategory,
      bySeverity,
      byRepairability,
    },
    findings: selectedFindings,
  }
}

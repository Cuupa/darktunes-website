import type { SalesStatementStatus } from '@/lib/api/salesStatements'

export type StatementWorkflowStep =
  | 'review'
  | 'draft'
  | 'approve'
  | 'notified'
  | 'viewed'
  | 'invoiced'
  | 'paid'

export const WORKFLOW_STEPS: { id: StatementWorkflowStep; label: string; description: string }[] = [
  { id: 'review', label: 'Daten prüfen', description: 'CSV-Import und Payouts in Reporting validieren' },
  { id: 'draft', label: 'Entwürfe', description: 'PDFs ins Portal hochladen (ohne E-Mail)' },
  { id: 'approve', label: 'Freigabe', description: 'Label-Freigabe und Künstler-Benachrichtigung' },
  { id: 'notified', label: 'Benachrichtigt', description: 'Künstler per E-Mail informiert' },
  { id: 'viewed', label: 'Gesehen', description: 'Künstler hat Statement geöffnet' },
  { id: 'invoiced', label: 'Rechnung', description: 'Künstler hat Rechnung erstellt' },
  { id: 'paid', label: 'Bezahlt', description: 'Zahlung erfasst und abgeschlossen' },
]

export type ArtistStatementWorkflowStatus =
  | 'not_linked'
  | 'not_uploaded'
  | 'draft'
  | 'label_approved'
  | 'artist_notified'
  | 'viewed'
  | 'invoiced'
  | 'paid'
  | 'acknowledged'
  | 'superseded'
  | 'cancelled'

export const WORKFLOW_STATUS_LABELS: Record<ArtistStatementWorkflowStatus, string> = {
  not_linked: 'Nicht verknüpft',
  not_uploaded: 'Bereit für Entwurf',
  draft: 'Freigabe ausstehend',
  label_approved: 'Freigegeben',
  artist_notified: 'Benachrichtigt',
  viewed: 'Gesehen',
  invoiced: 'Rechnung erstellt',
  paid: 'Bezahlt',
  acknowledged: 'Rechnung erstellt',
  superseded: 'Ersetzt',
  cancelled: 'Storniert',
}

export interface WorkflowKpis {
  approved: number
  viewed: number
  invoiced: number
  received: number
  paid: number
}

export interface WorkflowProgressInput {
  rowCount: number
  counts: Record<ArtistStatementWorkflowStatus, number>
  kpis?: WorkflowKpis
}

function approvedCountFromWorkflow(counts: Record<ArtistStatementWorkflowStatus, number>): number {
  return (
    counts.label_approved +
    counts.artist_notified +
    counts.viewed +
    counts.invoiced +
    counts.paid +
    counts.acknowledged
  )
}

function viewedCountFromWorkflow(counts: Record<ArtistStatementWorkflowStatus, number>): number {
  return counts.viewed + counts.invoiced + counts.paid + counts.acknowledged
}

function invoicedCountFromWorkflow(counts: Record<ArtistStatementWorkflowStatus, number>): number {
  return counts.invoiced + counts.paid + counts.acknowledged
}

export function workflowStatusFromStatement(
  status: SalesStatementStatus | undefined,
  hasArtistLink: boolean,
): ArtistStatementWorkflowStatus {
  if (!hasArtistLink) return 'not_linked'
  if (!status) return 'not_uploaded'
  if (status === 'draft') return 'draft'
  if (status === 'label_approved') return 'label_approved'
  if (status === 'artist_notified') return 'artist_notified'
  if (status === 'viewed') return 'viewed'
  if (status === 'invoiced' || status === 'acknowledged') return 'invoiced'
  if (status === 'paid') return 'paid'
  if (status === 'superseded') return 'superseded'
  if (status === 'cancelled') return 'cancelled'
  return 'draft'
}

export function deriveActiveWorkflowStep(input: WorkflowProgressInput): StatementWorkflowStep {
  const { rowCount, counts, kpis } = input
  if (rowCount === 0) return 'review'
  if (counts.not_uploaded > 0 || counts.not_linked > 0) return 'review'
  if (counts.draft > 0) return 'approve'

  const approved = kpis?.approved ?? approvedCountFromWorkflow(counts)
  const viewed = kpis?.viewed ?? viewedCountFromWorkflow(counts)
  const invoiced = kpis?.invoiced ?? invoicedCountFromWorkflow(counts)
  const received = kpis?.received ?? 0
  const paid = kpis?.paid ?? counts.paid

  if (approved > viewed) return 'notified'
  if (viewed > invoiced) return 'viewed'
  if (invoiced > received) return 'invoiced'
  if (received > paid) return 'invoiced'
  return 'paid'
}

export function deriveCompletedWorkflowSteps(input: WorkflowProgressInput): Set<StatementWorkflowStep> {
  const { rowCount, counts, kpis } = input
  const done = new Set<StatementWorkflowStep>()

  if (rowCount > 0) done.add('review')
  if (counts.not_uploaded === 0 && counts.not_linked < rowCount) done.add('draft')

  const approved = kpis?.approved ?? approvedCountFromWorkflow(counts)
  if (counts.draft === 0 && approved > 0) done.add('approve')

  const viewed = kpis?.viewed ?? viewedCountFromWorkflow(counts)
  if (approved > 0 && viewed >= approved) done.add('notified')

  const invoiced = kpis?.invoiced ?? invoicedCountFromWorkflow(counts)
  if (viewed > 0 && invoiced >= viewed) done.add('viewed')

  const received = kpis?.received ?? 0
  if (invoiced > 0 && received >= invoiced) done.add('invoiced')

  const paid = kpis?.paid ?? counts.paid
  if (paid > 0 && paid >= received) done.add('paid')

  return done
}

export function emptyWorkflowStatusCounts(): Record<ArtistStatementWorkflowStatus, number> {
  return {
    not_linked: 0,
    not_uploaded: 0,
    draft: 0,
    label_approved: 0,
    artist_notified: 0,
    viewed: 0,
    invoiced: 0,
    paid: 0,
    acknowledged: 0,
    superseded: 0,
    cancelled: 0,
  } satisfies Record<ArtistStatementWorkflowStatus, number>
}

export function statementMatchesPeriod(
  statement: { period_start: string | null; period_end: string | null; period: string },
  periodStart: string | undefined,
  periodEnd: string | undefined,
): boolean {
  if (!periodStart) return false
  const end = periodEnd || periodStart
  if (statement.period_start && statement.period_end) {
    return statement.period_start === periodStart && statement.period_end === end
  }
  return statement.period === periodStart || statement.period === end
}

export function countByWorkflowStatus<T extends { workflowStatus: ArtistStatementWorkflowStatus }>(
  rows: T[],
): Record<ArtistStatementWorkflowStatus, number> {
  return rows.reduce(
    (acc, row) => {
      acc[row.workflowStatus] += 1
      return acc
    },
    emptyWorkflowStatusCounts(),
  )
}
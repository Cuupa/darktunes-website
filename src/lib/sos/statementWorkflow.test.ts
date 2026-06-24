import { describe, expect, it } from 'vitest'
import {
  countByWorkflowStatus,
  deriveActiveWorkflowStep,
  deriveCompletedWorkflowSteps,
  emptyWorkflowStatusCounts,
  statementMatchesPeriod,
  WORKFLOW_STATUS_LABELS,
  workflowStatusFromStatement,
} from './statementWorkflow'

describe('statementWorkflow', () => {
  it('uses distinct labels for invoiced and acknowledged', () => {
    expect(WORKFLOW_STATUS_LABELS.invoiced).toBe('Rechnung erstellt')
    expect(WORKFLOW_STATUS_LABELS.acknowledged).toBe('Bestätigt')
    expect(WORKFLOW_STATUS_LABELS.invoiced).not.toBe(WORKFLOW_STATUS_LABELS.acknowledged)
  })

  it('maps statement statuses to workflow statuses', () => {
    expect(workflowStatusFromStatement(undefined, true)).toBe('not_uploaded')
    expect(workflowStatusFromStatement('draft', true)).toBe('draft')
    expect(workflowStatusFromStatement('artist_notified', true)).toBe('artist_notified')
    expect(workflowStatusFromStatement('viewed', true)).toBe('viewed')
    expect(workflowStatusFromStatement('invoiced', true)).toBe('invoiced')
    expect(workflowStatusFromStatement('acknowledged', true)).toBe('invoiced')
    expect(workflowStatusFromStatement('paid', true)).toBe('paid')
    expect(workflowStatusFromStatement('superseded', true)).toBe('superseded')
    expect(workflowStatusFromStatement('cancelled', true)).toBe('cancelled')
    expect(workflowStatusFromStatement(undefined, false)).toBe('not_linked')
  })

  it('matches statements by period_start and period_end', () => {
    expect(
      statementMatchesPeriod(
        { period_start: '2025-10-01', period_end: '2026-03-31', period: '2025-10' },
        '2025-10-01',
        '2026-03-31',
      ),
    ).toBe(true)

    expect(
      statementMatchesPeriod(
        { period_start: '2025-10-01', period_end: '2026-03-31', period: '2025-10' },
        '2025-01-01',
        '2025-03-31',
      ),
    ).toBe(false)
  })

  it('counts workflow rows', () => {
    const counts = countByWorkflowStatus([
      { workflowStatus: 'draft' },
      { workflowStatus: 'draft' },
      { workflowStatus: 'artist_notified' },
    ])

    expect(counts.draft).toBe(2)
    expect(counts.artist_notified).toBe(1)
  })

  it('derives active step from counts', () => {
    const counts = emptyWorkflowStatusCounts()
    counts.draft = 2
    expect(deriveActiveWorkflowStep({ rowCount: 3, counts })).toBe('approve')

    counts.draft = 0
    counts.artist_notified = 2
    expect(deriveActiveWorkflowStep({ rowCount: 3, counts })).toBe('notified')
  })

  it('marks completed steps from kpis', () => {
    const counts = emptyWorkflowStatusCounts()
    const done = deriveCompletedWorkflowSteps({
      rowCount: 2,
      counts,
      kpis: { approved: 2, viewed: 2, invoiced: 1, received: 0, paid: 0 },
    })
    expect(done.has('review')).toBe(true)
    expect(done.has('notified')).toBe(true)
    expect(done.has('viewed')).toBe(false)
    expect(done.has('invoiced')).toBe(false)
  })
})
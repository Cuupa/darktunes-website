import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountingGuidedWizard } from './AccountingGuidedWizard'

vi.mock('@phosphor-icons/react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  ArrowRight: () => <span data-testid="icon-arrow-right" />,
  List: () => <span data-testid="icon-list" />,
  UploadSimple: () => <span data-testid="icon-upload" />,
  ChartBar: () => <span data-testid="icon-chart" />,
  SealCheck: () => <span data-testid="icon-seal" />,
  Gear: () => <span data-testid="icon-gear" />,
  ShieldCheck: () => <span data-testid="icon-shield" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  Circle: () => <span data-testid="icon-circle" />,
  Warning: () => <span data-testid="icon-warning" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
}))

vi.mock('@/lib/i18n/accountingFallbacks', () => ({
  useAccountingLabels: () => ({
    coachSetupTitle: 'Step: Set up the period',
    coachSetupBody: 'Pick months',
    coachUploadTitle: 'Step: Upload sales files',
    coachUploadBody: 'Drop files',
    coachValidateTitle: 'Step: Automatic checks',
    coachValidateBody: 'Fix errors',
    coachReviewTitle: 'Step: Check payouts',
    coachReviewBody: 'Look at euros',
    coachSettleTitle: 'Step: Publish & pay',
    coachSettleBody: 'Create drafts',
    coachCheckPeriod: 'Period set',
    coachCheckFees: 'Fees ok',
    coachCheckLabel: 'Label ok',
    coachCheckRates: 'Rates loaded',
    coachCheckFiles: 'Files uploaded',
    coachCheckProcessed: 'Numbers ready',
    coachCheckNoBlocking: 'No blocking',
    coachCheckNoIssues: 'No issues',
    coachCheckIssuesCount: '{count} issues',
    coachCheckPayouts: '{count} payouts',
    coachCheckDrafts: 'Drafts',
    coachCheckApprove: 'Approve',
    coachCheckPay: 'Pay',
  }),
}))

describe('AccountingGuidedWizard navigation', () => {
  const onActiveStepChange = vi.fn()
  const onSwitchToAdvanced = vi.fn()

  beforeEach(() => {
    onActiveStepChange.mockReset()
    onSwitchToAdvanced.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  function renderWizard(
    overrides: Partial<React.ComponentProps<typeof AccountingGuidedWizard>> = {},
  ) {
    return render(
      <AccountingGuidedWizard
        hasData={false}
        isProcessing={false}
        activeStep="upload"
        onActiveStepChange={onActiveStepChange}
        onSwitchToAdvanced={onSwitchToAdvanced}
        uploadPanel={<div>upload-panel</div>}
        reviewPanel={<div>review-panel</div>}
        settlePanel={<div>settle-panel</div>}
        {...overrides}
      />,
    )
  }

  it('shows upload panel and disables continue without data', () => {
    renderWizard()

    expect(screen.getByText('upload-panel')).toBeInTheDocument()
    expect(screen.queryByText('review-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    expect(screen.getAllByText(/Upload at least one sales file/i).length).toBeGreaterThanOrEqual(1)
  })

  it('uses Continue to publish label on the review step', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    expect(screen.getByText('review-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to publish' })).toBeEnabled()
  })

  it('advances to settle when continue is clicked on review', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    fireEvent.click(screen.getByRole('button', { name: 'Continue to publish' }))
    expect(onActiveStepChange).toHaveBeenCalledWith('settle')
  })

  it('jumps to settle when the settle stepper control is clicked', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    fireEvent.click(screen.getByRole('button', { name: 'Create drafts, approve, and pay' }))
    expect(onActiveStepChange).toHaveBeenCalledWith('settle')
  })

  it('shows step progress in the footer', () => {
    renderWizard({ hasData: true, activeStep: 'review' })
    expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument()
  })

  it('notifies import ready without auto-advancing from upload', () => {
    const onImportReady = vi.fn()
    const { rerender } = renderWizard({ hasData: false, activeStep: 'upload', onImportReady })

    rerender(
      <AccountingGuidedWizard
        hasData
        isProcessing={false}
        activeStep="upload"
        onActiveStepChange={onActiveStepChange}
        onSwitchToAdvanced={onSwitchToAdvanced}
        onImportReady={onImportReady}
        uploadPanel={<div>upload-panel</div>}
        reviewPanel={<div>review-panel</div>}
        settlePanel={<div>settle-panel</div>}
      />,
    )

    expect(onImportReady).toHaveBeenCalledTimes(1)
    expect(onActiveStepChange).not.toHaveBeenCalledWith('review')
  })
})

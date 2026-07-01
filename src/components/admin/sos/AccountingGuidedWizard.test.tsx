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
  })

  it('uses Open settlement label on the review step', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    expect(screen.getByText('review-panel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open settlement' })).toBeEnabled()
  })

  it('advances to settle when continue is clicked on review', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    fireEvent.click(screen.getByRole('button', { name: 'Open settlement' }))
    expect(onActiveStepChange).toHaveBeenCalledWith('settle')
  })

  it('jumps to settle when the settle stepper control is clicked', () => {
    renderWizard({ hasData: true, activeStep: 'review' })

    fireEvent.click(screen.getByRole('button', { name: 'Save analytics, create drafts, and approve' }))
    expect(onActiveStepChange).toHaveBeenCalledWith('settle')
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
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportingPanel } from './ReportingPanel'
import type { ArtistRevenue } from '@/lib/sos/types'

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

function makeRevenue(artist: string): ArtistRevenue {
  return {
    artist,
    believeRevenue: 0,
    bandcampRevenue: 0,
    darkmerchRevenue: 0,
    manualRevenue: 0,
    totalRevenue: 100,
    splitPercentage: 50,
    finalAmount: 50,
    totalQuantity: 0,
    totalExpenses: 0,
    distributionFeeDeducted: 0,
    totalStreamRevenue: 0,
    totalDownloadRevenue: 0,
    platformBreakdown: [],
    countryBreakdown: [],
    monthlyBreakdown: [],
    releaseBreakdown: [],
    physicalReleasesRevenue: 0,
    digitalSplitPercentage: 50,
    physicalSplitPercentage: 50,
    darkmerchSplitPercentage: 50,
  }
}

describe('ReportingPanel release workflow CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the release workflow banner when callback is provided', () => {
    const onGoToReleaseWorkflow = vi.fn()

    render(
      <ReportingPanel
        revenues={[makeRevenue('Artist A')]}
        onDownloadPDF={vi.fn()}
        onDownloadExcel={vi.fn()}
        onDownloadAll={vi.fn()}
        onDownloadSelected={vi.fn()}
        onGoToReleaseWorkflow={onGoToReleaseWorkflow}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Open Release Workflow/i }))
    expect(onGoToReleaseWorkflow).toHaveBeenCalledTimes(1)
  })

  it('does not render publish buttons anymore', () => {
    render(
      <ReportingPanel
        revenues={[makeRevenue('Artist A')]}
        onDownloadPDF={vi.fn()}
        onDownloadExcel={vi.fn()}
        onDownloadAll={vi.fn()}
        onDownloadSelected={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publish Selected/i })).not.toBeInTheDocument()
  })
})
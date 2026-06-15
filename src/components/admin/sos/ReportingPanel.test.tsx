import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportingPanel } from './ReportingPanel'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'

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

describe('ReportingPanel publish actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows row-level publish only for linked artists', () => {
    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Linked Artist', artistId: '123e4567-e89b-12d3-a456-426614174000' },
      { id: '2', name: 'Unlinked Artist' },
    ]

    render(
      <ReportingPanel
        revenues={[makeRevenue('Linked Artist'), makeRevenue('Unlinked Artist')]}
        onDownloadPDF={vi.fn()}
        onDownloadExcel={vi.fn()}
        onDownloadAll={vi.fn()}
        onDownloadSelected={vi.fn()}
        onPublishToPortal={vi.fn().mockResolvedValue(undefined)}
        labelArtists={labelArtists}
      />
    )

    expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(1)
  })

  it('publishes selected artists sequentially from toolbar action', async () => {
    const publishMock = vi.fn().mockResolvedValue(undefined)

    render(
      <ReportingPanel
        revenues={[makeRevenue('Artist A'), makeRevenue('Artist B')]}
        onDownloadPDF={vi.fn()}
        onDownloadExcel={vi.fn()}
        onDownloadAll={vi.fn()}
        onDownloadSelected={vi.fn()}
        onPublishToPortal={publishMock}
        labelArtists={[
          { id: '1', name: 'Artist A', artistId: '123e4567-e89b-12d3-a456-426614174000' },
          { id: '2', name: 'Artist B' },
        ]}
      />
    )

    const publishSelectedButton = screen.getByRole('button', { name: 'Publish Selected' })
    expect(publishSelectedButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(publishSelectedButton).not.toBeDisabled()

    fireEvent.click(publishSelectedButton)

    await waitFor(() => {
      expect(publishMock).toHaveBeenNthCalledWith(1, 'Artist A')
      expect(publishMock).toHaveBeenNthCalledWith(2, 'Artist B')
    })
  })
})

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Asset } from '@/types'
import { AssetPressFields } from './AssetPressFields'

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean
    onCheckedChange?: (value: boolean) => void
    id?: string
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    filename: 'live.jpg',
    originalFilename: 'Band Live',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    r2Key: 'press/live.jpg',
    publicUrl: 'https://cdn.example.com/press/live.jpg',
    createdAt: '2026-01-01T00:00:00Z',
    artistIds: [],
    tags: [],
    isPressApproved: false,
    pressSuggested: false,
    downloadableForPress: true,
    ...overrides,
  }
}

describe('AssetPressFields', () => {
  const artists = [{ id: 'artist-1', name: 'Dark Artist' }]
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onAssetChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders press metadata fields and artist suggestion badge', () => {
    render(
      <AssetPressFields
        asset={makeAsset({ pressSuggested: true })}
        artists={artists}
        authToken="token-123"
        onSave={onSave}
        onAssetChange={onAssetChange}
      />,
    )

    expect(screen.getByText('Press metadata')).toBeInTheDocument()
    expect(screen.getByLabelText('Alt text')).toBeInTheDocument()
    expect(screen.getByText('Artist suggestion')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('approves an asset and clears the artist suggestion flag', async () => {
    render(
      <AssetPressFields
        asset={makeAsset({ pressSuggested: true })}
        artists={artists}
        authToken="token-123"
        onSave={onSave}
        onAssetChange={onAssetChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mark as press' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          isPressApproved: true,
          pressSuggested: false,
        }),
      )
    })
    expect(onAssetChange).toHaveBeenCalledWith(
      expect.objectContaining({ isPressApproved: true, pressSuggested: false }),
    )
    expect(mockToastSuccess).toHaveBeenCalledWith('Marked as press photo')
  })

  it('saves edited metadata via onSave', async () => {
    render(
      <AssetPressFields
        asset={makeAsset({ isPressApproved: true, altText: 'Old alt' })}
        artists={artists}
        authToken="token-123"
        onSave={onSave}
        onAssetChange={onAssetChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'New alt text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save press metadata' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ altText: 'New alt text', isPressApproved: true }),
      )
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Press metadata saved')
  })

  it('adds an approved asset to the label-wide press kit', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ item: { id: 'kit-1' } }),
    } as Response)

    render(
      <AssetPressFields
        asset={makeAsset({ isPressApproved: true })}
        artists={artists}
        authToken="token-123"
        onSave={onSave}
        onAssetChange={onAssetChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/press-kit',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token-123',
          }),
          body: JSON.stringify({ assetId: 'asset-1', artistId: null }),
        }),
      )
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Added to press kit')
  })

  it('shows an error when add-to-kit is attempted without auth', async () => {
    render(
      <AssetPressFields
        asset={makeAsset({ isPressApproved: true })}
        artists={artists}
        authToken={null}
        onSave={onSave}
        onAssetChange={onAssetChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Not authenticated')
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
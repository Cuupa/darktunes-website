import type { ImgHTMLAttributes } from 'react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PressAsset } from '@/types'
import { PressKitBuilder } from './PressKitBuilder'

const { mockToastSuccess, mockToastError, mockGetSession } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src, fill, unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
    src: string
    fill?: boolean
    unoptimized?: boolean
  }) => {
    void fill
    void unoptimized
    void props
    return <span role="img" aria-label={alt} data-src={src} />
  },
}))

vi.mock('./file-explorer/AssetPicker', () => ({
  AssetPicker: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <button type="button" data-testid="asset-picker" onClick={onClose}>
        Close picker
      </button>
    ) : null,
}))

vi.mock('@phosphor-icons/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@phosphor-icons/react')>()
  return {
    ...actual,
    ArrowDown: () => null,
    ArrowUp: () => null,
    FolderOpen: () => null,
    Plus: () => null,
    Trash: () => null,
  }
})

function makePressAsset(overrides: Partial<PressAsset> = {}): PressAsset {
  return {
    id: 'asset-1',
    kitItemId: 'kit-1',
    kitDisplayOrder: 0,
    filename: 'live-1.jpg',
    originalFilename: 'Band Live 1',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    r2Key: 'press/live-1.jpg',
    publicUrl: 'https://cdn.example.com/press/live-1.jpg',
    createdAt: '2026-01-01T00:00:00Z',
    artistIds: [],
    tags: [],
    isPressApproved: true,
    pressSuggested: false,
    pressCategory: 'live',
    photographerCredit: 'Jane Doe',
    downloadableForPress: true,
    ...overrides,
  }
}

describe('PressKitBuilder', () => {
  const artists = [{ id: 'artist-1', name: 'Dark Artist' }]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'admin-token' } },
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  it('loads and renders press kit items for the label-wide scope', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [makePressAsset()] }),
    } as Response)

    render(<PressKitBuilder artists={artists} />)

    await waitFor(() => {
      expect(screen.getByText('Band Live 1')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/press-kit?artistId=label',
      expect.objectContaining({
        headers: { Authorization: 'Bearer admin-token' },
      }),
    )
    expect(screen.getByText('Label-wide')).toBeInTheDocument()
    expect(screen.getByText(/1 item\(s\)/)).toBeInTheDocument()
  })

  it('shows an empty-state message when the kit has no items', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response)

    render(<PressKitBuilder artists={artists} />)

    await waitFor(() => {
      expect(
        screen.getByText(/No assets in this kit yet/i),
      ).toBeInTheDocument()
    })
  })

  it('removes a kit item via DELETE', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [makePressAsset()] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)

    render(<PressKitBuilder artists={artists} />)

    await waitFor(() => {
      expect(screen.getByText('Band Live 1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/press-kit/kit-1',
        expect.objectContaining({
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      )
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Removed from press kit')
    await waitFor(() => {
      expect(screen.queryByText('Band Live 1')).not.toBeInTheDocument()
    })
  })

  it('reorders items when move-down is clicked', async () => {
    const secondItem = makePressAsset({
      id: 'asset-2',
      kitItemId: 'kit-2',
      kitDisplayOrder: 1,
      originalFilename: 'Band Live 2',
      filename: 'live-2.jpg',
    })
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [makePressAsset(), secondItem] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)

    render(<PressKitBuilder artists={artists} />)

    await waitFor(() => {
      expect(screen.getByText('Band Live 1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Move Band Live 1 down' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/press-kit/reorder',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            artistId: null,
            orderedItemIds: ['kit-2', 'kit-1'],
          }),
        }),
      )
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Order updated')
  })

  it('opens the asset picker when Add asset is clicked', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response)

    render(<PressKitBuilder artists={artists} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add asset' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add asset' }))
    expect(screen.getByTestId('asset-picker')).toBeInTheDocument()
  })
})
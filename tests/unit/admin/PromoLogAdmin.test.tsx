import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Artist, PromoLogEntry } from '@/types'
import { PromoLogAdmin } from '../../../app/admin/promo-log/_components/PromoLogAdmin'

const {
  mockPush,
  mockRefresh,
  mockGetUser,
  mockCreatePromoLogEntry,
  mockDeletePromoLogEntry,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetUser: vi.fn(),
  mockCreatePromoLogEntry: vi.fn(),
  mockDeletePromoLogEntry: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/admin/promo-log',
}))

vi.mock('@phosphor-icons/react', () => ({
  CalendarBlank: () => null,
  CurrencyEur: () => null,
  LinkSimple: () => null,
  MegaphoneSimple: () => null,
  Spinner: () => null,
  Trash: () => null,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

vi.mock('@/lib/api/promoLog', () => ({
  createPromoLogEntry: mockCreatePromoLogEntry,
  deletePromoLogEntry: mockDeletePromoLogEntry,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
  }>({})

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string
      onValueChange?: (value: string) => void
      children: React.ReactNode
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        {children}
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(SelectContext)

      return (
        <select
          value={context.value}
          onChange={(event) => context.onValueChange?.(event.target.value)}
        >
          {children}
        </select>
      )
    },
    SelectItem: ({
      children,
      value,
    }: {
      children: React.ReactNode
      value: string
    }) => <option value={value}>{children}</option>,
  }
})

const ARTISTS: Artist[] = [
  {
    id: 'artist-1',
    name: 'Artist One',
    slug: 'artist-one',
    bio: '',
    genres: [],
    imageUrl: '',
    featured: false,
    isVisible: true,
  },
  {
    id: 'artist-2',
    name: 'Artist Two',
    slug: 'artist-two',
    bio: '',
    genres: [],
    imageUrl: '',
    featured: false,
    isVisible: true,
  },
]

const ENTRIES: PromoLogEntry[] = [
  {
    id: 'entry-1',
    artistId: 'artist-1',
    actionDate: '2026-06-15',
    description: 'Sent a newsletter blast.',
    budgetAmount: 120,
    budgetCurrency: 'EUR',
    proofUrl: 'https://example.com/proof',
    proofR2Key: null,
    createdBy: 'user-1',
    createdAt: '2026-06-15T10:00:00.000Z',
  },
]

describe('PromoLogAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockCreatePromoLogEntry.mockResolvedValue(undefined)
    mockDeletePromoLogEntry.mockResolvedValue(undefined)
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders a friendly empty state when no artists exist', () => {
    render(<PromoLogAdmin artists={[]} activeArtistId={null} initialEntries={[]} />)

    expect(screen.getByText(/no artists are available yet/i)).toBeInTheDocument()
  })

  it('pushes the artistId query param and refreshes when the artist selection changes', async () => {
    render(<PromoLogAdmin artists={ARTISTS} activeArtistId="artist-1" initialEntries={ENTRIES} />)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'artist-2' } })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/promo-log?artistId=artist-2')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('creates a promo log entry with the authenticated user id and refreshes the page', async () => {
    render(<PromoLogAdmin artists={ARTISTS} activeArtistId="artist-1" initialEntries={ENTRIES} />)

    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Booked playlist pitching support.' },
    })
    fireEvent.change(screen.getByLabelText(/budget amount/i), {
      target: { value: '99.50' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://example.com/proof'), {
      target: { value: 'https://example.com/report' },
    })

    fireEvent.click(screen.getByRole('button', { name: /create entry/i }))

    await waitFor(() => {
      expect(mockCreatePromoLogEntry).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          artist_id: 'artist-1',
          description: 'Booked playlist pitching support.',
          budget_amount: 99.5,
          budget_currency: 'EUR',
          proof_url: 'https://example.com/report',
          proof_r2_key: null,
          created_by: 'user-1',
        }),
      )
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Promo log entry created.')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('deletes an entry after confirmation and refreshes the page', async () => {
    render(<PromoLogAdmin artists={ARTISTS} activeArtistId="artist-1" initialEntries={ENTRIES} />)

    fireEvent.click(screen.getByRole('button', { name: /delete promo log entry from/i }))

    await waitFor(() => {
      expect(globalThis.confirm).toHaveBeenCalledWith('Delete this marketing activity?')
      expect(mockDeletePromoLogEntry).toHaveBeenCalledWith(expect.any(Object), 'entry-1')
    })

    expect(mockToastSuccess).toHaveBeenCalledWith('Promo log entry deleted.')
    expect(mockRefresh).toHaveBeenCalled()
  })
})

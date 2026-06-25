import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ArtistForm, type ArtistFormData } from './ArtistForm'

const EMPTY_FORM: ArtistFormData = {
  name: '',
  slug: '',
  bio: '',
  genres: '',
  imageUrl: '',
  logoUrl: '',
  spotifyUrl: '',
  appleMusicUrl: '',
  instagramUrl: '',
  youtubeUrl: '',
  websiteUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  tiktokUrl: '',
  bandcampUrl: '',
  shopUrl: '',
  country: '',
  foundedYear: '',
  email: '',
  vatNumber: '',
  featured: false,
  isEuNonGerman: false,
  isVisible: true,
  notes: '',
  spotifyId: '',
  discogsId: '',
  songkickId: '',
  bandsintownId: '',
  bandsintownApiKey: '',
  lastfmName: '',
  soundchartsId: '',
  storageQuotaMb: '',
  smartLinks: [],
  imagePositionX: 50,
  imagePositionY: 50,
  imageScale: 1,
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  }),
}))

vi.mock('@/components/admin/TiptapEditor', () => ({
  TiptapEditor: ({ onChange, value }: { onChange: (v: string) => void; value: string }) => (
    <textarea
      aria-label="Bio editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('../file-explorer/AssetPicker', () => ({
  AssetPicker: () => null,
}))

vi.mock('./ImageUploadButton', () => ({
  ImageUploadButton: () => null,
}))

vi.mock('@/components/ui/genre-tag-picker', () => ({
  GenreTagPicker: () => <div data-testid="genre-picker" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => {
  const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />,
  )
  Input.displayName = 'MockInput'
  return { Input }
})

vi.mock('@/components/ui/textarea', () => {
  const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props, ref) => <textarea ref={ref} {...props} />,
  )
  Textarea.displayName = 'MockTextarea'
  return { Textarea }
})

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void; id?: string }) => (
    <input
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}))

describe('ArtistForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    )
  })

  it('renders admin tabs including Business and Sync-IDs', () => {
    render(<ArtistForm value={EMPTY_FORM} onChange={vi.fn()} isLoading={false} />)

    expect(screen.getByRole('tab', { name: /Identity/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Business/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sync-IDs/i })).toBeInTheDocument()
  })

  it('hides admin-only tabs in artist mode', () => {
    render(<ArtistForm value={EMPTY_FORM} onChange={vi.fn()} isLoading={false} mode="artist" />)

    expect(screen.queryByRole('tab', { name: /Business/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Sync-IDs/i })).not.toBeInTheDocument()
  })

  it('auto-generates slug from artist name in admin mode', async () => {
    render(<ArtistForm value={EMPTY_FORM} onChange={vi.fn()} isLoading={false} />)

    fireEvent.change(screen.getByLabelText(/Name \*/i), { target: { value: 'Neuroklast' } })

    await waitFor(() => {
      expect(screen.getByLabelText(/Slug/i)).toHaveValue('neuroklast')
    })
  })

  it('submits save with entered artist name', async () => {
    const onChange = vi.fn()

    render(<ArtistForm value={EMPTY_FORM} onChange={onChange} isLoading={false} />)

    fireEvent.change(screen.getByLabelText(/Name \*/i), { target: { value: 'Test Artist' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Artist/i }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    expect(onChange.mock.calls[0]?.[0]).toMatchObject({
      name: 'Test Artist',
      slug: 'test-artist',
    })
  })
})
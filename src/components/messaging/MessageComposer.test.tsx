import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MessageComposer } from './MessageComposer'

vi.mock('@phosphor-icons/react', () => ({
  Check: () => null,
  Files: () => null,
  X: () => null,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (html: string, text: string) => void
  }) => (
    <textarea
      aria-label="Body"
      value={value}
      onChange={(event) => onChange(event.target.value, event.target.value)}
    />
  ),
}))

function mockLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size },
  })
}

describe('MessageComposer artist loading states', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('disables artist selection while artists are loading', () => {
    render(
      <MessageComposer
        artists={[]}
        isArtistsLoading
        onSend={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Select artists' })).toBeDisabled()
    expect(screen.getAllByText('Loading artists…')).not.toHaveLength(0)
  })

  it('shows an artist load error and keeps the selector disabled', () => {
    render(
      <MessageComposer
        artists={[]}
        artistLoadError="Artists could not be loaded."
        onSend={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Select artists' })).toBeDisabled()
    expect(screen.getAllByText('Artists could not be loaded.')).not.toHaveLength(0)
  })
})

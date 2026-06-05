/**
 * Unit tests for ImageInsertDialog — Step 2 options form.
 *
 * These tests verify that choosing float/width/caption/link options
 * produces the correct setResizableImage call when the Insert button is clicked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ─── Mock Tiptap (not available in jsdom/vitest without a browser DOM) ────────
const mockSetResizableImage = vi.fn()
const mockRun = vi.fn().mockReturnValue(true)
const mockFocus = vi.fn()
const mockChain = vi.fn()

function resetMocks() {
  mockRun.mockReturnValue(true)
  mockSetResizableImage.mockReturnValue({ run: mockRun })
  mockFocus.mockReturnValue({ setResizableImage: mockSetResizableImage })
  mockChain.mockReturnValue({ focus: mockFocus })
}

const mockEditor = {
  get chain() { return mockChain },
  isActive: vi.fn().mockReturnValue(false),
  getAttributes: vi.fn().mockReturnValue({}),
} as unknown as import('@tiptap/core').Editor

// ─── Mock AssetPicker ─────────────────────────────────────────────────────────
vi.mock('@/components/admin/file-explorer/AssetPicker', () => ({
  AssetPicker: ({ open }: { open: boolean }) =>
    open ? <div data-testid="asset-picker" /> : null,
}))

// ─── Mock Supabase ────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: vi.fn(() => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  })),
}))

// ─── Mock Tabs so all content renders at once (avoids Radix pointer-event issues
//     in jsdom that prevent tab switching with fireEvent). ─────────────────────
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: React.PropsWithChildren) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) =>
    <button type="button" role="tab" data-value={value}>{children}</button>,
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

import { ImageInsertDialog } from '../../../../src/components/admin/tiptap/ImageInsertDialog'

// ─── Helper: render dialog pre-filled to step 2 (options) ────────────────────
async function renderAtOptionsStep() {
  const onClose = vi.fn()
  render(<ImageInsertDialog editor={mockEditor} open onClose={onClose} />)

  // With mocked Tabs, all content is visible. Find the URL input directly.
  const urlInput = screen.getByPlaceholderText('https://example.com/image.jpg')
  await act(async () => {
    fireEvent.change(urlInput, { target: { value: 'https://test.com/photo.jpg' } })
  })

  // Click Next to advance to options step
  const nextBtn = screen.getByRole('button', { name: /next/i })
  await act(async () => { fireEvent.click(nextBtn) })

  return { onClose }
}

describe('ImageInsertDialog – options step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
  })

  it('shows "Image Options" heading after source selection', async () => {
    await renderAtOptionsStep()
    expect(screen.getByRole('heading', { name: /image options/i })).toBeTruthy()
  })

  it('calls setResizableImage with correct src when Insert is clicked', async () => {
    await renderAtOptionsStep()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'https://test.com/photo.jpg' })
    )
  })

  it('uses default float=none and width=100% when not changed', async () => {
    await renderAtOptionsStep()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-float': 'none', 'data-width': '100%' })
    )
  })

  it('passes alt text to setResizableImage', async () => {
    await renderAtOptionsStep()
    const altInput = screen.getByRole('textbox', { name: /alt text/i })
    await act(async () => {
      fireEvent.change(altInput, { target: { value: 'My photo' } })
    })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ alt: 'My photo' })
    )
  })

  it('passes link href to setResizableImage when provided', async () => {
    await renderAtOptionsStep()
    const linkInput = screen.getByLabelText(/link \(optional\)/i)
    await act(async () => {
      fireEvent.change(linkInput, { target: { value: 'https://example.com' } })
    })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-link-href': 'https://example.com' })
    )
  })

  it('passes null link-href when not set', async () => {
    await renderAtOptionsStep()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-link-href': null })
    )
  })

  it('passes caption text when show-caption toggle is enabled', async () => {
    await renderAtOptionsStep()
    const captionToggle = screen.getByRole('switch', { name: /show caption/i })
    await act(async () => { fireEvent.click(captionToggle) })
    const captionInput = screen.getByPlaceholderText(/caption text/i)
    await act(async () => {
      fireEvent.change(captionInput, { target: { value: 'Taken at sunset' } })
    })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-caption': 'Taken at sunset' })
    )
  })

  it('passes null caption when show-caption is disabled', async () => {
    await renderAtOptionsStep()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(mockSetResizableImage).toHaveBeenCalledWith(
      expect.objectContaining({ 'data-caption': null })
    )
  })

  it('calls onClose after Insert', async () => {
    const { onClose } = await renderAtOptionsStep()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /insert/i })) })
    expect(onClose).toHaveBeenCalled()
  })

  it('goes back to source step when Back is clicked', async () => {
    await renderAtOptionsStep()
    const backBtn = screen.getByRole('button', { name: /back/i })
    await act(async () => { fireEvent.click(backBtn) })
    expect(screen.getByRole('heading', { name: /insert image/i })).toBeTruthy()
  })
})


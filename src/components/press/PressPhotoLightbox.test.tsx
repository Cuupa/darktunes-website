import type { ImgHTMLAttributes } from 'react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PressAsset } from '@/types'
import { PressPhotoLightbox } from './PressPhotoLightbox'

const mockedState = vi.hoisted(() => ({
  reducedMotion: false,
}))

vi.mock('next/image', () => ({
  default: ({ alt, src, fill, unoptimized, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & {
    src: string
    fill?: boolean
    unoptimized?: boolean
    priority?: boolean
  }) => {
    void fill
    void unoptimized
    void priority
    void props
    return <span role="img" aria-label={alt} data-src={src} />
  },
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      void props
      return <div>{children}</div>
    },
  },
  useReducedMotion: () => mockedState.reducedMotion,
}))

const photos: PressAsset[] = [
  {
    id: 'asset-1',
    kitItemId: 'kit-1',
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
    altText: 'Live performance',
    kitDisplayOrder: 0,
  },
  {
    id: 'asset-2',
    kitItemId: 'kit-2',
    filename: 'portrait.jpg',
    originalFilename: 'Portrait',
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    r2Key: 'press/portrait.jpg',
    publicUrl: 'https://cdn.example.com/press/portrait.jpg',
    createdAt: '2026-01-02T00:00:00Z',
    artistIds: [],
    tags: [],
    isPressApproved: true,
    pressSuggested: false,
    pressCategory: 'photo',
    downloadableForPress: true,
    kitDisplayOrder: 1,
  },
]

describe('PressPhotoLightbox', () => {
  beforeEach(() => {
    mockedState.reducedMotion = false
  })

  it('renders the initial photo title and navigation controls for multiple photos', () => {
    render(
      <PressPhotoLightbox
        photos={photos}
        initialIndex={0}
        artistName="Dark Artist"
        open
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Band Live 1', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeEnabled()
    expect(screen.getByRole('img', { name: 'Live performance' })).toBeInTheDocument()
  })

  it('advances to the next photo when Next is clicked', () => {
    render(
      <PressPhotoLightbox
        photos={photos}
        initialIndex={0}
        open
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByRole('heading', { name: 'Portrait', hidden: true })).toBeInTheDocument()
    expect(screen.getByText(/photo · 2 \/ 2/i)).toBeInTheDocument()
  })

  it('calls onDownload with the active photo', () => {
    const onDownload = vi.fn()
    render(
      <PressPhotoLightbox
        photos={photos}
        initialIndex={0}
        open
        onClose={vi.fn()}
        onDownload={onDownload}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset-1' }))
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <PressPhotoLightbox
        photos={photos}
        initialIndex={0}
        open
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close press photo viewer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
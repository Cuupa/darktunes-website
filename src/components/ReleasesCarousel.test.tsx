import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import enDict from '@/i18n/dictionaries/en.json'
import type { Release } from '@/types'
import { ReleasesCarousel } from './ReleasesCarousel'

type MockMotionDivProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onDragEnd'> & {
  onDragEnd?: (_event: unknown, info: { offset: { x: number } }) => void
} & Record<string, unknown>

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: MockMotionDivProps) => {
      const {
        children,
        animate,
        custom,
        drag,
        dragConstraints,
        dragElastic,
        exit,
        initial,
        onDragEnd,
        transition,
        variants,
        ...domProps
      } = props

      void animate
      void custom
      void drag
      void dragConstraints
      void dragElastic
      void exit
      void initial
      void transition
      void variants

      return (
        <div data-testid="carousel-motion-surface" {...domProps}>
          {children}
          <button
            type="button"
            data-testid="mock-drag-left"
            onClick={() => {
              if (typeof onDragEnd === 'function') {
                onDragEnd({}, { offset: { x: -60 } })
              }
            }}
          >
            Drag left
          </button>
          <button
            type="button"
            data-testid="mock-drag-right"
            onClick={() => {
              if (typeof onDragEnd === 'function') {
                onDragEnd({}, { offset: { x: 60 } })
              }
            }}
          >
            Drag right
          </button>
        </div>
      )
    },
    img: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
  useReducedMotion: () => true,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

const buildRelease = (id: string, title: string): Release => ({
  id,
  title,
  artistId: `artist-${id}`,
  artistName: `Artist ${id}`,
  releaseDate: '2025-01-01',
  coverArt: `https://example.com/${id}.jpg`,
  type: 'single',
  featured: false,
  isVisible: true,
  isPromo: false,
})

describe('ReleasesCarousel', () => {
  const releases = [
    buildRelease('1', 'Release 1'),
    buildRelease('2', 'Release 2'),
    buildRelease('3', 'Release 3'),
  ]

  it('keeps release links clickable after next, prev, and dot navigation', () => {
    render(<ReleasesCarousel releases={releases} dict={enDict.releases} locale="en" />)

    fireEvent.click(screen.getByRole('button', { name: 'Next release' }))
    expect(fireEvent.click(screen.getByRole('link', { name: 'Release 2 – Artist 2' }))).toBe(true)

    fireEvent.click(screen.getByRole('tab', { name: 'Go to release 3' }))
    expect(fireEvent.click(screen.getByRole('link', { name: 'Release 3 – Artist 3' }))).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Previous release' }))
    expect(fireEvent.click(screen.getByRole('link', { name: 'Release 2 – Artist 2' }))).toBe(true)
  })

  it('suppresses only the click that immediately follows a real drag', () => {
    render(<ReleasesCarousel releases={releases} dict={enDict.releases} locale="en" />)

    const surface = screen.getByTestId('carousel-motion-surface')
    const link = screen.getByRole('link', { name: 'Release 1 – Artist 1' })

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(surface, { clientX: 24, clientY: 10 })
    fireEvent.pointerUp(surface, { clientX: 24, clientY: 10 })

    expect(fireEvent.click(link)).toBe(false)
    expect(fireEvent.click(link)).toBe(true)
  })

  it('continues to change slides on swipe drag end', () => {
    render(<ReleasesCarousel releases={releases} dict={enDict.releases} locale="en" />)

    fireEvent.click(screen.getByTestId('mock-drag-left'))
    expect(screen.getByRole('link', { name: 'Release 2 – Artist 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mock-drag-right'))
    expect(screen.getByRole('link', { name: 'Release 1 – Artist 1' })).toBeInTheDocument()
  })
})

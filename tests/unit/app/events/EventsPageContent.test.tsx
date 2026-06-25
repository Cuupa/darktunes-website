import type { AnchorHTMLAttributes } from 'react'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import enDict from '@/i18n/dictionaries/en.json'
import type { Concert } from '@/types'
import { EventsPageContent } from '../../../../app/events/_components/EventsPageContent'

vi.mock('next/link', () => {
  const Link = React.forwardRef<
    HTMLAnchorElement,
    AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >(({ href, children, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  ))

  Link.displayName = 'MockLink'

  return { default: Link }
})

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      const { children, ...domProps } = props
      delete domProps.initial
      delete domProps.animate
      delete domProps.transition
      return <div {...domProps}>{children}</div>
    },
  },
  useReducedMotion: () => false,
}))

const concert: Concert = {
  id: 'concert-1',
  artistId: 'artist-1',
  artistName: 'Dark Artist',
  eventName: 'Synth Night',
  venueName: 'Industrial Hall',
  venueAddress: 'Noise Street 1',
  venueCity: 'Berlin',
  venueCountry: 'Germany',
  concertDate: '2026-10-31T20:00:00.000Z',
  ticketUrl: 'https://tickets.example.com/concert-1',
  songkickId: null,
  bandsintownId: null,
  status: 'scheduled',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  eventTime: '20:00',
  eventType: 'gig',
  trailerUrl: null,
  venueLat: 52.52,
  venueLng: 13.405,
  venueOsmId: null,
  newsPostId: null,
}

describe('EventsPageContent', () => {
  it('renders a single full-card overlay link for the event detail page', () => {
    render(<EventsPageContent concerts={[concert]} />)

    const overlayLink = screen.getByRole('link', {
      name: `${concert.artistName} – ${concert.eventName}`,
    })

    expect(overlayLink).toHaveAttribute('href', `/events/${concert.id}`)
    expect(overlayLink).toHaveClass('absolute', 'inset-0', 'z-0', 'rounded-[inherit]')

    const card = overlayLink.parentElement
    expect(card).toHaveClass(
      'relative',
      'group',
      'cursor-pointer',
      'hover:border-accent/50',
      'transition-colors',
    )
    expect(card?.firstElementChild).toBe(overlayLink)

    const contentWrapper = overlayLink.nextElementSibling
    expect(contentWrapper).toHaveClass('relative', 'z-10', 'pointer-events-none')

    expect(screen.getByText(concert.artistName).closest('a')).toBeNull()
    expect(screen.getByText(concert.eventName).closest('a')).toBeNull()

    const detailLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href') === `/events/${concert.id}`)
    expect(detailLinks).toHaveLength(1)
  })

  it('keeps ticket and navigation links interactive without nesting them inside the overlay link', () => {
    render(<EventsPageContent concerts={[concert]} />)

    const overlayLink = screen.getByRole('link', {
      name: `${concert.artistName} – ${concert.eventName}`,
    })
    const ticketLink = screen.getByRole('link', {
      name: `${enDict.concerts.ticketLink} (${enDict.concerts.opensInNewTab})`,
    })
    const mapsLink = screen.getByRole('link', {
      name: `${concert.eventName} – ${enDict.concerts.navLink}`,
    })

    expect(ticketLink).toHaveAttribute('href', concert.ticketUrl)
    expect(ticketLink).toHaveAttribute('target', '_blank')
    expect(ticketLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(ticketLink).toHaveClass('relative', 'z-20', 'pointer-events-auto')

    expect(mapsLink).toHaveAttribute('href', `https://maps.google.com/maps?q=${concert.venueLat},${concert.venueLng}`)
    expect(mapsLink).toHaveAttribute('target', '_blank')
    expect(mapsLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(mapsLink).toHaveClass('relative', 'z-20', 'pointer-events-auto')

    expect(overlayLink.contains(ticketLink)).toBe(false)
    expect(overlayLink.contains(mapsLink)).toBe(false)
  })
})

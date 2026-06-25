import type { AnchorHTMLAttributes } from 'react'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { testMessages } from '@/test/mockNextIntl'
import type { Concert } from '@/types'
import { Concerts } from '@/components/Concerts'

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
      delete domProps.whileInView
      delete domProps.viewport
      return <div {...domProps}>{children}</div>
    },
  },
  useReducedMotion: () => false,
  useInView: () => true,
}))

const concert: Concert = {
  id: 'concert-1',
  artistId: 'artist-1',
  artistName: 'Blackbook',
  eventName: 'Eastside Open Air 2026',
  venueName: 'Eastside Open Air 2026',
  venueAddress: null,
  venueCity: 'Halle (Saale)',
  venueCountry: 'Germany',
  concertDate: '2026-07-03T20:00:00.000Z',
  ticketUrl: 'https://tickets.example.com/concert-1',
  songkickId: null,
  bandsintownId: null,
  status: 'scheduled',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  eventTime: '20:00',
  eventType: 'gig',
  trailerUrl: null,
  venueLat: null,
  venueLng: null,
  venueOsmId: null,
  newsPostId: null,
}

const sectionLabels = { heading: '', subheading: '' }

// jsdom does not implement scrollTo on HTMLDivElement
beforeEach(() => {
  HTMLDivElement.prototype.scrollTo = vi.fn()
})

describe('Concerts homepage section', () => {
  it('renders a full-card overlay link to the event detail page', () => {
    render(
      <Concerts concerts={[concert]} editMode={false} sectionLabels={sectionLabels} onLabelChange={() => undefined} />,
    )

    const overlayLink = screen.getByRole('link', {
      name: `${concert.artistName} – ${concert.eventName}`,
    })

    expect(overlayLink).toHaveAttribute('href', `/events/${concert.id}`)
    expect(overlayLink).toHaveClass('absolute', 'inset-0', 'z-0', 'rounded-[inherit]')

    // The card is the overlay link's parent
    const card = overlayLink.parentElement
    expect(card).toHaveClass('relative', 'group', 'cursor-pointer', 'hover:border-accent/50', 'transition-colors')
    // Overlay link must be the first child so it sits behind everything
    expect(card?.firstElementChild).toBe(overlayLink)

    // Content wrapper must disable pointer events so the overlay link is reachable
    const contentWrapper = overlayLink.nextElementSibling
    expect(contentWrapper).toHaveClass('relative', 'z-10', 'pointer-events-none')

    // Exactly one link to this event detail page
    const detailLinks = screen.getAllByRole('link').filter(
      (link) => link.getAttribute('href') === `/events/${concert.id}`,
    )
    expect(detailLinks).toHaveLength(1)
  })

  it('ticket link is interactive (pointer-events-auto, z-20) and not nested inside the overlay link', () => {
    render(
      <Concerts concerts={[concert]} editMode={false} sectionLabels={sectionLabels} onLabelChange={() => undefined} />,
    )

    const overlayLink = screen.getByRole('link', {
      name: `${concert.artistName} – ${concert.eventName}`,
    })
    const ticketLink = screen.getByRole('link', {
      name: `${testMessages.concerts.ticketLink} (${testMessages.concerts.opensInNewTab})`,
    })

    expect(ticketLink).toHaveAttribute('href', concert.ticketUrl)
    expect(ticketLink).toHaveAttribute('target', '_blank')
    expect(ticketLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(ticketLink).toHaveClass('relative', 'z-20', 'pointer-events-auto')

    // Ticket link must NOT be inside the overlay link (no nested <a>)
    expect(overlayLink.contains(ticketLink)).toBe(false)
  })
})

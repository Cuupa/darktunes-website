import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpotifyMultiPlayer } from './SpotifyMultiPlayer'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

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
  useReducedMotion: () => true,
}))

vi.mock('@/components/ConsentGate', () => ({
  ConsentGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/animations/LenisProvider', () => ({
  useLenis: () => undefined,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

describe('SpotifyMultiPlayer', () => {
  it('loads Spotify iframe only after click-to-load activation', () => {
    render(
      <SpotifyMultiPlayer
        playlists={[{ uri: 'spotify:playlist:37i9dQZF1DWWqNV5cS50j6', label: 'Label Playlist' }]}
        loadLabel="Load Spotify"
      />,
    )

    expect(screen.queryByTitle(/Spotify playlist:/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Load Spotify' }))

    const iframe = screen.getByTitle('Spotify playlist: Label Playlist')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('loading', 'lazy')
  })

  it('renders only the active playlist iframe and updates src on tab change', () => {
    render(
      <SpotifyMultiPlayer
        playlists={[
          { uri: 'spotify:playlist:37i9dQZF1DWWqNV5cS50j6', label: 'One' },
          { uri: 'spotify:playlist:37i9dQZF1DX4WYpdgoIcn6', label: 'Two' },
        ]}
        loadLabel="Load Spotify"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load Spotify' }))

    let iframes = screen.getAllByTitle(/Spotify playlist:/i)
    expect(iframes).toHaveLength(1)
    expect(iframes[0]).toHaveAttribute(
      'src',
      expect.stringContaining(getSpotifyEmbedPath('spotify:playlist:37i9dQZF1DWWqNV5cS50j6')),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Two' }))

    iframes = screen.getAllByTitle(/Spotify playlist:/i)
    expect(iframes).toHaveLength(1)
    expect(iframes[0]).toHaveAttribute(
      'src',
      expect.stringContaining(getSpotifyEmbedPath('spotify:playlist:37i9dQZF1DX4WYpdgoIcn6')),
    )
  })
})

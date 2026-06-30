'use client'

import { LinkSimple } from '@phosphor-icons/react'
import { buildPlatformLinkEntries } from '@/lib/platforms/buildPlatformLinkEntries'
import type { Artist } from '@/types'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface SmartLinksBlockProps {
  artist?: Artist
  smartLinks?: Array<{ label: string; url: string }>
  theme: FanPageTheme
  title?: string
}

export function SmartLinksBlock({ artist, smartLinks, theme, title }: SmartLinksBlockProps) {
  const colors = resolveThemeColors(theme)
  const custom = smartLinks ?? artist?.smartLinks ?? []
  const platforms = artist
    ? buildPlatformLinkEntries({
        platformLinks: artist.platformLinks,
        spotifyUrl: artist.spotifyUrl,
        appleMusicUrl: artist.appleMusicUrl,
        youtubeUrl: artist.youtubeUrl,
        bandcampUrl: artist.bandcampUrl,
      })
    : []

  const links = [
    ...custom.map((l) => ({ label: l.label, url: l.url })),
    ...platforms.map((p) => ({ label: p.key, url: p.url })),
  ]

  if (links.length === 0) {
    return <p className="text-sm opacity-60">—</p>
  }

  return (
    <div>
      {title ? (
        <h2 className="mb-4 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <a
            key={`${link.label}-${link.url}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium transition hover:border-white/25"
            style={{ color: colors.text }}
          >
            <LinkSimple size={18} style={{ color: colors.accent }} aria-hidden />
            <span className="truncate">{link.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
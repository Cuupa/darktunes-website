'use client'

import Link from 'next/link'
import Image from 'next/image'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { Release } from '@/types'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface ReleaseGridBlockProps {
  limit?: number
  releases?: Release[]
  theme: FanPageTheme
  title?: string
}

export function ReleaseGridBlock({ limit = 6, releases = [], theme, title }: ReleaseGridBlockProps) {
  const colors = resolveThemeColors(theme)
  const items = releases.filter((r) => r.isVisible && !r.isPromo).slice(0, limit)

  if (items.length === 0) {
    return <p className="text-sm opacity-60">—</p>
  }

  return (
    <div>
      {title ? (
        <h2 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {items.map((release) => {
          const thumb = getSquareThumbnail(release.coverArt, 400)
          return (
            <Link
              key={release.id}
              href={`/releases/${release.id}`}
              className="group block overflow-hidden rounded-lg border border-white/10 bg-black/20 transition hover:border-white/25"
            >
              <div className="relative aspect-square">
                {thumb ? (
                  <Image src={thumb} alt={release.title} fill unoptimized className="object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs opacity-50">—</div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold" style={{ color: colors.text }}>
                  {release.title}
                </p>
                <p className="text-xs uppercase tracking-wider opacity-60">{release.type}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
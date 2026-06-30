'use client'

import Image from 'next/image'
import { Play } from '@phosphor-icons/react'
import type { Video } from '@/types'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface VideoGridBlockProps {
  videos?: Video[]
  theme: FanPageTheme
  title?: string
  limit?: number
}

export function VideoGridBlock({ videos = [], theme, title, limit = 3 }: VideoGridBlockProps) {
  const colors = resolveThemeColors(theme)
  const items = videos.filter((v) => v.isVisible).slice(0, limit)

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((video) => (
          <a
            key={video.id}
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block overflow-hidden rounded-lg border border-white/10"
          >
            <div className="relative aspect-video">
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                unoptimized
                className="object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                <Play size={40} weight="fill" style={{ color: colors.accent }} aria-hidden />
              </div>
            </div>
            <p className="p-3 text-sm font-medium" style={{ color: colors.text }}>
              {video.title}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}
'use client'

import Image from 'next/image'
import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import { FanPageImage } from './FanPageImage'
import { cn } from '@/lib/utils'

interface HeroBlockProps {
  headline?: string
  subheadline?: string
  image?: FanPageImageProps
  showCountdown?: boolean
  showLogo?: boolean
  compact?: boolean
  theme: FanPageTheme
  artistName?: string
  logoUrl?: string
}

export function HeroBlock({
  headline,
  subheadline,
  image,
  showCountdown,
  showLogo,
  compact,
  theme,
  artistName,
  logoUrl,
}: HeroBlockProps) {
  const colors = resolveThemeColors(theme)
  const title = headline || artistName || ''

  return (
    <div className={cn('flex flex-col gap-6', compact ? 'items-center text-center' : 'lg:flex-row lg:items-end lg:gap-10')}>
      <div className={cn('relative overflow-hidden rounded-lg', compact ? 'h-32 w-32' : 'h-48 w-full lg:h-72 lg:max-w-md shrink-0')}>
        <FanPageImage image={image} alt={title} fill className="rounded-lg" width={800} />
      </div>
      <div className={cn('flex-1', compact && 'text-center')}>
        {showLogo && logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={220}
            height={48}
            unoptimized
            className={cn('mb-4 h-12 w-auto max-w-[220px] object-contain', compact && 'mx-auto')}
          />
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: colors.primary }}>
          {title}
        </h1>
        {subheadline ? (
          <p className="mt-3 text-lg opacity-80" style={{ color: colors.text }}>
            {subheadline}
          </p>
        ) : null}
        {showCountdown ? (
          <p className="mt-4 text-sm font-mono uppercase tracking-widest opacity-60" style={{ color: colors.accent }}>
            Coming soon
          </p>
        ) : null}
      </div>
    </div>
  )
}
'use client'

import Image from 'next/image'
import type { FanPageImageProps } from '@/lib/fan-page/schema/documentV1'
import { cn } from '@/lib/utils'

interface FanPageImageProps_ {
  image?: FanPageImageProps
  alt: string
  className?: string
  width?: number
  fill?: boolean
}

export function FanPageImage({ image, alt, className, width = 1200, fill }: FanPageImageProps_) {
  if (!image?.src) {
    return (
      <div
        className={cn('bg-muted/40 flex items-center justify-center text-muted-foreground text-sm', className)}
        aria-hidden
      >
        —
      </div>
    )
  }

  const src = image.src
  const style = {
    objectFit: (image.objectFit ?? 'cover') as React.CSSProperties['objectFit'],
    objectPosition: `${image.focalX ?? 50}% ${image.focalY ?? 50}%`,
    transform: image.scale && image.scale > 1 ? `scale(${image.scale})` : undefined,
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={image.alt ?? alt}
        fill
        className={cn('h-full w-full', className)}
        style={style}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={image.alt ?? alt}
      width={width}
      height={Math.round(width * 0.6)}
      className={className}
      style={style}
    />
  )
}
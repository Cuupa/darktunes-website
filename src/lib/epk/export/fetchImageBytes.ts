/**
 * src/lib/epk/export/fetchImageBytes.ts
 *
 * Fetches and validates remote images for PDF export.
 * Only allows HTTPS URLs from known CDN origins.
 */

import sharp from 'sharp'
import { isAllowedEpkImageUrl } from '@/lib/epk/epkImageProxy'
import type { EpkImageCrop } from '@/lib/epk/schema/documentV2'

export interface CompressedImage {
  bytes: Uint8Array
  width: number
  height: number
  mime: 'image/jpeg' | 'image/png'
}

export interface FetchImageOptions {
  crop?: EpkImageCrop
  flipX?: boolean
  flipY?: boolean
}

function isCropRect(value: EpkImageCrop | FetchImageOptions): value is EpkImageCrop {
  return 'x' in value && 'y' in value && 'width' in value && 'height' in value
}

export async function fetchAndCompressImage(
  url: string,
  maxWidth = 1200,
  options?: EpkImageCrop | FetchImageOptions,
): Promise<CompressedImage | null> {
  const crop = options
    ? isCropRect(options)
      ? options
      : options.crop
    : undefined
  const flipX = options && !isCropRect(options) ? Boolean(options.flipX) : false
  const flipY = options && !isCropRect(options) ? Boolean(options.flipY) : false
  const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!url || !isAllowedEpkImageUrl(url, r2PublicUrl)) return null

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())

    let pipeline = sharp(buffer).rotate()
    if (crop) {
      pipeline = pipeline.extract({
        left: Math.max(0, Math.round(crop.x)),
        top: Math.max(0, Math.round(crop.y)),
        width: Math.max(1, Math.round(crop.width)),
        height: Math.max(1, Math.round(crop.height)),
      })
    }
    if (flipX) pipeline = pipeline.flop()
    if (flipY) pipeline = pipeline.flip()
    const processed = await pipeline
      .toColorspace('srgb')
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })

    return {
      bytes: new Uint8Array(processed.data),
      width: processed.info.width,
      height: processed.info.height,
      mime: 'image/jpeg',
    }
  } catch {
    return null
  }
}
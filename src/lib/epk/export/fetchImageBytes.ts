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

export async function fetchAndCompressImage(
  url: string,
  maxWidth = 1200,
  crop?: EpkImageCrop,
): Promise<CompressedImage | null> {
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
    const processed = await pipeline
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
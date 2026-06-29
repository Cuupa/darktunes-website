/**
 * src/lib/epk/export/renderGradientToJpeg.ts
 *
 * Rasterizes linear gradients for WYSIWYG PDF export via SVG + sharp.
 */

import sharp from 'sharp'
import type { EpkGradient } from '@/lib/epk/gradients'
import { gradientToSvg } from '@/lib/epk/gradients'

export async function renderGradientToJpeg(
  width: number,
  height: number,
  gradient: EpkGradient,
  maxDimension = 2400,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const scale = Math.min(1, maxDimension / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  try {
    const svg = gradientToSvg(outW, outH, gradient, `grad-${outW}x${outH}`)
    const bytes = await sharp(Buffer.from(svg))
      .toColorspace('srgb')
      .jpeg({ quality: 92 })
      .toBuffer()
    return { bytes: new Uint8Array(bytes), width: outW, height: outH }
  } catch {
    return null
  }
}
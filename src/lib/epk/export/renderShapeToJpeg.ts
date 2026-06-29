/**
 * Rasterizes solid/rounded shapes for WYSIWYG PDF export via SVG + sharp.
 */

import sharp from 'sharp'

export async function renderShapeToJpeg(
  width: number,
  height: number,
  options: {
    fill: string
    cornerRadius?: number
    stroke?: string
    strokeWidth?: number
  },
  maxDimension = 2400,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const scale = Math.min(1, maxDimension / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))
  const radius = Math.max(0, Math.round((options.cornerRadius ?? 0) * scale))
  const strokeWidth = Math.max(0, (options.strokeWidth ?? 0) * scale)

  const strokeAttrs =
    options.stroke && strokeWidth > 0
      ? `stroke="${options.stroke}" stroke-width="${strokeWidth}"`
      : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">
  <rect x="0" y="0" width="${outW}" height="${outH}" rx="${radius}" ry="${radius}" fill="${options.fill}" ${strokeAttrs}/>
</svg>`

  try {
    const bytes = await sharp(Buffer.from(svg))
      .toColorspace('srgb')
      .jpeg({ quality: 92 })
      .toBuffer()
    return { bytes: new Uint8Array(bytes), width: outW, height: outH }
  } catch {
    return null
  }
}
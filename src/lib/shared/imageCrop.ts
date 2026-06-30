/**
 * Shared image crop rectangle — used by EPK canvas and Fan Page image blocks.
 */

import { z } from 'zod'

export const imageCropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
})

export type ImageCrop = z.infer<typeof imageCropSchema>

export function getDefaultImageCrop(naturalWidth: number, naturalHeight: number): ImageCrop {
  return { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
}
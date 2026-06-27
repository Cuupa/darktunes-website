/**
 * src/lib/epk/konvaFill.ts
 *
 * Maps solid colors and linear gradients to Konva Rect fill props.
 */

import type { EpkGradient } from './gradients'
import { gradientToKonvaProps } from './gradients'

export interface KonvaRectFillProps {
  fill?: string
  fillLinearGradientStartPoint?: { x: number; y: number }
  fillLinearGradientEndPoint?: { x: number; y: number }
  fillLinearGradientColorStops?: (number | string)[]
}

export function getKonvaRectFillProps(
  width: number,
  height: number,
  solidFill?: string,
  gradient?: EpkGradient | null,
): KonvaRectFillProps {
  if (gradient) {
    return gradientToKonvaProps(width, height, gradient)
  }
  return { fill: solidFill ?? '#292929' }
}
/**
 * src/lib/epk/editor/snapGuides.ts
 *
 * Grid + alignment snapping for the EPK canvas editor.
 */

import { snapValue } from '@/lib/epk/textLayout'

export interface EpkSnapBox {
  x: number
  y: number
  width: number
  height: number
}

export interface EpkSnapGuides {
  vertical: number[]
  horizontal: number[]
}

export interface EpkSnapResult {
  x: number
  y: number
  guides: EpkSnapGuides
}

const DEFAULT_THRESHOLD = 8

function boxPoints(box: EpkSnapBox): { x: number[]; y: number[] } {
  const right = box.x + box.width
  const bottom = box.y + box.height
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  return {
    x: [box.x, centerX, right],
    y: [box.y, centerY, bottom],
  }
}

export function computeSnapPosition(
  box: EpkSnapBox,
  options: {
    snapEnabled: boolean
    gridSize: number
    pageWidth: number
    pageHeight: number
    others: EpkSnapBox[]
    threshold?: number
  },
): EpkSnapResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  let x = box.x
  let y = box.y
  const guides: EpkSnapGuides = { vertical: [], horizontal: [] }

  if (!options.snapEnabled) {
    return { x, y, guides }
  }

  const moving = boxPoints(box)
  const targetsX: number[] = [0, options.pageWidth / 2, options.pageWidth]
  const targetsY: number[] = [0, options.pageHeight / 2, options.pageHeight]

  for (const other of options.others) {
    const points = boxPoints(other)
    targetsX.push(...points.x)
    targetsY.push(...points.y)
  }

  let bestDx = threshold + 1
  let bestDy = threshold + 1
  let snapGuideX: number | null = null
  let snapGuideY: number | null = null

  for (const point of moving.x) {
    for (const target of targetsX) {
      const delta = target - point
      const abs = Math.abs(delta)
      if (abs <= threshold && abs < bestDx) {
        bestDx = abs
        x = box.x + delta
        snapGuideX = target
      }
    }
  }

  for (const point of moving.y) {
    for (const target of targetsY) {
      const delta = target - point
      const abs = Math.abs(delta)
      if (abs <= threshold && abs < bestDy) {
        bestDy = abs
        y = box.y + delta
        snapGuideY = target
      }
    }
  }

  if (snapGuideX === null) {
    x = snapValue(x, options.gridSize, true)
  } else {
    guides.vertical.push(snapGuideX)
  }

  if (snapGuideY === null) {
    y = snapValue(y, options.gridSize, true)
  } else {
    guides.horizontal.push(snapGuideY)
  }

  return { x, y, guides }
}
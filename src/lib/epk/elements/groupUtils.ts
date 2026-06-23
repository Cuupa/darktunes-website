/**
 * src/lib/epk/elements/groupUtils.ts
 *
 * Helpers for EPK canvas group elements (bounding box, child lookup, flattening).
 */

import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { createEpkElementId } from '@/lib/epk/schema/elementIds'

const MIN_GROUP_SIZE = 8

export function getGroupedChildIds(document: EpkDocumentV2): Set<string> {
  const ids = new Set<string>()
  for (const element of document.elements) {
    if (element.type === 'group' && element.children) {
      for (const childId of element.children) ids.add(childId)
    }
  }
  return ids
}

export function getTopLevelPageElements(document: EpkDocumentV2, pageId: string): EpkElement[] {
  const groupedChildIds = getGroupedChildIds(document)
  return document.elements
    .filter((el) => el.pageId === pageId && !groupedChildIds.has(el.id))
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function getGroupChildren(document: EpkDocumentV2, group: EpkElement): EpkElement[] {
  if (!group.children?.length) return []
  const byId = new Map(document.elements.map((el) => [el.id, el]))
  return group.children
    .map((id) => byId.get(id))
    .filter((el): el is EpkElement => Boolean(el))
    .sort((a, b) => a.zIndex - b.zIndex)
}

export function computeGroupBounds(elements: EpkElement[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: MIN_GROUP_SIZE, height: MIN_GROUP_SIZE }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    minX = Math.min(minX, el.x)
    minY = Math.min(minY, el.y)
    maxX = Math.max(maxX, el.x + el.width)
    maxY = Math.max(maxY, el.y + el.height)
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(MIN_GROUP_SIZE, maxX - minX),
    height: Math.max(MIN_GROUP_SIZE, maxY - minY),
  }
}

export function createGroupFromElements(
  document: EpkDocumentV2,
  pageId: string,
  elementIds: string[],
): EpkElement | null {
  const selected = document.elements.filter((el) => elementIds.includes(el.id))
  if (selected.length < 2) return null
  if (selected.some((el) => el.type === 'group' || el.pageId !== pageId)) return null

  const groupedChildIds = getGroupedChildIds(document)
  if (selected.some((el) => groupedChildIds.has(el.id))) return null

  const bounds = computeGroupBounds(selected)
  const zIndex = Math.max(...selected.map((el) => el.zIndex))

  return {
    id: createEpkElementId('group'),
    pageId,
    type: 'group',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    style: {},
    children: selected.map((el) => el.id),
  }
}

export function flattenGroupElements(document: EpkDocumentV2, pageId: string): EpkElement[] {
  const topLevel = getTopLevelPageElements(document, pageId)
  const flattened: EpkElement[] = []

  for (const element of topLevel) {
    if (element.type !== 'group') {
      flattened.push(element)
      continue
    }
    flattened.push(...getGroupChildren(document, element))
  }

  return flattened.sort((a, b) => a.zIndex - b.zIndex)
}
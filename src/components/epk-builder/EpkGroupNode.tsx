'use client'

/**
 * src/components/epk-builder/EpkGroupNode.tsx
 *
 * Konva group container that renders grouped child elements together.
 */

import { Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { getGroupChildren } from '@/lib/epk/elements/groupUtils'
import { EpkCanvasElementNode } from './EpkCanvasElementNode'

interface EpkGroupNodeProps {
  document: EpkDocumentV2
  element: EpkElement
  listening?: boolean
  isSelected?: boolean
  onSelect?: (id: string, additive: boolean) => void
  onChange?: (id: string, patch: Partial<EpkElement>) => void
  onGroupDrag?: (groupId: string, dx: number, dy: number) => void
  onDoubleClickText?: (id: string) => void
  registerRef?: (id: string, node: Konva.Node | null) => void
  onSnapDragMove?: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => { x: number; y: number }
  onDragEnd?: () => void
}

export function EpkGroupNode({
  document,
  element,
  listening = false,
  isSelected = false,
  onSelect,
  onChange,
  onGroupDrag,
  onDoubleClickText,
  registerRef,
  onSnapDragMove,
  onDragEnd: onDragEndCallback,
}: EpkGroupNodeProps) {
  const children = getGroupChildren(document, element)
  const interactive = listening && Boolean(onSelect && onChange)

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      opacity={element.style.opacity ?? 1}
      listening={interactive}
      draggable={interactive && !element.locked}
      onClick={
        interactive
          ? (e) => {
              e.cancelBubble = true
              onSelect?.(element.id, e.evt.shiftKey)
            }
          : undefined
      }
      onTap={
        interactive
          ? (e) => {
              e.cancelBubble = true
              onSelect?.(element.id, false)
            }
          : undefined
      }
      onDragMove={
        interactive && onSnapDragMove
          ? (e) => {
              const node = e.target
              const snapped = onSnapDragMove(
                element.id,
                node.x(),
                node.y(),
                element.width,
                element.height,
              )
              node.position({ x: snapped.x, y: snapped.y })
            }
          : undefined
      }
      onDragEnd={
        interactive
          ? (e) => {
              const node = e.target
              const dx = node.x() - element.x
              const dy = node.y() - element.y
              if (dx !== 0 || dy !== 0) {
                onGroupDrag?.(element.id, dx, dy)
                node.position({ x: element.x, y: element.y })
              }
              onDragEndCallback?.()
            }
          : undefined
      }
      ref={registerRef ? (node) => registerRef(element.id, node) : undefined}
    >
      {interactive && (
        <Rect
          x={0}
          y={0}
          width={element.width}
          height={element.height}
          stroke={isSelected ? '#493687' : '#49368755'}
          strokeWidth={isSelected ? 2 : 1}
          dash={[6, 4]}
          listening={false}
        />
      )}
      {children.map((child) => (
        <EpkCanvasElementNode
          key={child.id}
          element={child}
          offsetX={element.x}
          offsetY={element.y}
          listening={interactive}
          isSelected={false}
          onSelect={onSelect}
          onChange={onChange}
          onDoubleClickText={onDoubleClickText}
          registerRef={registerRef}
          onSnapDragMove={onSnapDragMove}
          onDragEnd={onDragEndCallback}
        />
      ))}
    </Group>
  )
}
'use client'

/**
 * src/components/epk-builder/EpkCanvasElementNode.tsx
 *
 * Shared Konva node renderer for EPK canvas elements (preview + editor children).
 */

import '@/lib/epk/konvaShapes'
import { useEffect, useState } from 'react'
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import { resolveEpkCanvasImageSrc } from '@/lib/epk/epkImageProxy'
import { getEpkImageLayout } from '@/lib/epk/imageFit'
import type { EpkElement } from '@/lib/epk/schema/documentV2'

function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = resolveEpkCanvasImageSrc(src)
  }, [src])

  return image
}

export interface EpkCanvasElementNodeProps {
  element: EpkElement
  listening?: boolean
  isSelected?: boolean
  offsetX?: number
  offsetY?: number
  onSelect?: (id: string, additive: boolean) => void
  onChange?: (id: string, patch: Partial<EpkElement>) => void
  onDoubleClickText?: (id: string) => void
  registerRef?: (id: string, node: Konva.Node | null) => void
}

export function EpkCanvasElementNode({
  element,
  listening = false,
  isSelected = false,
  offsetX = 0,
  offsetY = 0,
  onSelect,
  onChange,
  onDoubleClickText,
  registerRef,
}: EpkCanvasElementNodeProps) {
  const image = useHtmlImage(element.type === 'image' || element.type === 'logo' ? element.src : undefined)

  if (!element.visible || element.type === 'group') return null

  const interactive = listening && Boolean(onSelect && onChange)
  const x = element.x - offsetX
  const y = element.y - offsetY

  const commonProps = {
    id: element.id,
    x,
    y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    opacity: element.style.opacity ?? 1,
    listening: interactive,
    draggable: interactive && !element.locked,
    onClick: interactive
      ? (e: Konva.KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true
          onSelect?.(element.id, e.evt.shiftKey)
        }
      : undefined,
    onTap: interactive
      ? (e: Konva.KonvaEventObject<TouchEvent>) => {
          e.cancelBubble = true
          onSelect?.(element.id, false)
        }
      : undefined,
    onDragEnd: interactive
      ? (e: Konva.KonvaEventObject<DragEvent>) => {
          onChange?.(element.id, {
            x: e.target.x() + offsetX,
            y: e.target.y() + offsetY,
          })
        }
      : undefined,
    onTransformEnd: interactive
      ? (e: Konva.KonvaEventObject<Event>) => {
          const node = e.target
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          const isImage = element.type === 'image' || element.type === 'logo'
          const uniformScale = isImage ? Math.max(scaleX, scaleY) : scaleX
          const uniformScaleY = isImage ? uniformScale : scaleY
          node.scaleX(1)
          node.scaleY(1)
          onChange?.(element.id, {
            x: node.x() + offsetX,
            y: node.y() + offsetY,
            width: Math.max(8, node.width() * uniformScale),
            height: Math.max(8, node.height() * uniformScaleY),
            rotation: node.rotation(),
          })
        }
      : undefined,
    ref: registerRef ? (node: Konva.Node | null) => registerRef(element.id, node) : undefined,
  }

  switch (element.type) {
    case 'shape':
      return (
        <Rect
          {...commonProps}
          fill={element.style.fill ?? '#292929'}
          stroke={isSelected ? '#493687' : element.style.stroke}
          strokeWidth={isSelected ? 2 : (element.style.strokeWidth ?? 0)}
          cornerRadius={element.style.cornerRadius}
        />
      )
    case 'text':
      return (
        <Text
          {...commonProps}
          text={element.content ?? ''}
          fontSize={element.style.fontSize ?? 14}
          fontFamily={element.style.fontFamily ?? 'Helvetica, Arial, sans-serif'}
          fontStyle={
            element.style.fontWeight === 700 || element.style.fontWeight === 'bold'
              ? 'bold'
              : 'normal'
          }
          fill={element.style.fill ?? '#ffffff'}
          align={element.style.textAlign ?? 'left'}
          lineHeight={element.style.lineHeight}
          onDblClick={interactive ? () => onDoubleClickText?.(element.id) : undefined}
          onDblTap={interactive ? () => onDoubleClickText?.(element.id) : undefined}
        />
      )
    case 'image':
    case 'logo': {
      if (!image) return null
      const layout = getEpkImageLayout(element, image.naturalWidth, image.naturalHeight)
      return (
        <Group
          id={element.id}
          x={x}
          y={y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          opacity={element.style.opacity ?? 1}
          listening={interactive}
          draggable={interactive && !element.locked}
          onClick={commonProps.onClick}
          onTap={commonProps.onTap}
          onDragEnd={commonProps.onDragEnd}
          onTransformEnd={commonProps.onTransformEnd}
          ref={registerRef ? (node: Konva.Node | null) => registerRef(element.id, node) : undefined}
        >
          <Rect
            width={element.width}
            height={element.height}
            fill="transparent"
            stroke={isSelected ? '#493687' : undefined}
            strokeWidth={isSelected ? 2 : 0}
          />
          <KonvaImage
            x={layout.offsetX}
            y={layout.offsetY}
            width={layout.drawWidth}
            height={layout.drawHeight}
            image={image}
            crop={layout.crop}
            listening={false}
          />
        </Group>
      )
    }
    default:
      return null
  }
}
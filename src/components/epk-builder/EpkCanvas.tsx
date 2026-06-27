'use client'

/**
 * src/components/epk-builder/EpkCanvas.tsx
 *
 * Interactive Konva canvas with selection, drag, resize, and rotate.
 */

import '@/lib/epk/konvaShapes'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from 'react'
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useReducedMotion } from 'framer-motion'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import { getTopLevelPageElements } from '@/lib/epk/elements/groupUtils'
import { EPK_FONTS_LOADED_EVENT } from './EpkFontLoader'
import { EpkCanvasContextMenu, type EpkContextMenuAnchor } from './EpkContextMenu'
import { EpkCanvasElementNode } from './EpkCanvasElementNode'
import { EpkGroupNode } from './EpkGroupNode'
import { EpkTextEditor } from './EpkTextEditor'

interface EpkCanvasProps {
  onOpenAssetPicker?: () => void
  onReplaceImage?: () => void
  onEditText?: (id: string) => void
}

function GridLines({
  width,
  height,
  gridSize,
}: {
  width: number
  height: number
  gridSize: number
}) {
  const lines: ReactNode[] = []
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke="#ffffff14"
        strokeWidth={1}
        listening={false}
      />,
    )
  }
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke="#ffffff14"
        strokeWidth={1}
        listening={false}
      />,
    )
  }
  return <>{lines}</>
}

export function EpkCanvas({ onOpenAssetPicker, onReplaceImage, onEditText }: EpkCanvasProps = {}) {
  const document = useEpkEditorStore((s) => s.document)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const zoom = useEpkEditorStore((s) => s.zoom)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const selectElements = useEpkEditorStore((s) => s.selectElements)
  const clearSelection = useEpkEditorStore((s) => s.clearSelection)
  const updateElement = useEpkEditorStore((s) => s.updateElement)
  const moveGroupByDelta = useEpkEditorStore((s) => s.moveGroupByDelta)
  const setZoom = useEpkEditorStore((s) => s.setZoom)
  const showGrid = useEpkEditorStore((s) => s.showGrid)
  const gridSize = useEpkEditorStore((s) => s.gridSize)

  const prefersReducedMotion = useReducedMotion()
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map())
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<EpkContextMenuAnchor | null>(null)

  const page = document.pages.find((p) => p.id === activePageId) ?? document.pages[0]

  const pageId = page?.id
  const elements = useMemo(
    () => (pageId ? getTopLevelPageElements(document, pageId) : []),
    [document, pageId],
  )

  const registerRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node)
    else nodeRefs.current.delete(id)
  }, [])

  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    const nodes = selectedIds
      .map((id) => nodeRefs.current.get(id))
      .filter((n): n is Konva.Node => Boolean(n))
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedIds, elements])

  useEffect(() => {
    const redraw = () => stageRef.current?.batchDraw()
    window.addEventListener(EPK_FONTS_LOADED_EVENT, redraw)
    return () => window.removeEventListener(EPK_FONTS_LOADED_EVENT, redraw)
  }, [])

  const handleSelect = useCallback(
    (id: string, additive: boolean) => {
      if (additive) {
        const next = selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id]
        selectElements(next)
      } else {
        selectElements([id])
      }
    },
    [selectElements, selectedIds],
  )

  const resolveElementId = useCallback(
    (node: Konva.Node): string | null => {
      const stage = node.getStage()
      let current: Konva.Node | null = node
      while (current && current !== stage) {
        const id = current.id()
        if (id && document.elements.some((el) => el.id === id)) return id
        current = current.getParent()
      }
      return null
    },
    [document.elements],
  )

  const handleStageContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault()
      const elementId = resolveElementId(e.target)
      if (elementId) handleSelect(elementId, false)
      setContextMenu({ x: e.evt.clientX, y: e.evt.clientY })
    },
    [handleSelect, resolveElementId],
  )

  const selectedImageElement =
    selectedIds.length === 1
      ? document.elements.find(
          (el) =>
            el.id === selectedIds[0] && (el.type === 'image' || el.type === 'logo'),
        )
      : undefined

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.08 : 0.08
      setZoom(zoom + delta)
    },
    [setZoom, zoom],
  )

  if (!page) return null

  const stageWidth = page.width * zoom
  const stageHeight = page.height * zoom
  const editingElement = editingTextId
    ? document.elements.find((el) => el.id === editingTextId)
    : null

  return (
    <div
      className="relative overflow-auto rounded-lg border border-border bg-muted/30 p-4"
      data-lenis-prevent
      onWheel={handleWheel}
    >
      <div
        className="relative mx-auto shadow-lg"
        style={{ width: stageWidth, height: stageHeight }}
      >
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          scaleX={zoom}
          scaleY={zoom}
          onContextMenu={handleStageContextMenu}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage() && !editingTextId) {
              clearSelection()
            }
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage() && !editingTextId) {
              clearSelection()
            }
          }}
        >
          <Layer>
            {page.background.type === 'color' && (
              <Rect
                x={0}
                y={0}
                width={page.width}
                height={page.height}
                fill={page.background.color ?? '#101010'}
                listening={false}
              />
            )}
            {showGrid ? (
              <GridLines width={page.width} height={page.height} gridSize={gridSize} />
            ) : null}
            {elements.map((element) =>
              element.type === 'group' ? (
                <EpkGroupNode
                  key={element.id}
                  document={document}
                  element={element}
                  listening
                  isSelected={selectedIds.includes(element.id)}
                  onSelect={handleSelect}
                  onChange={updateElement}
                  onGroupDrag={moveGroupByDelta}
                  onDoubleClickText={(id) => {
                    setEditingTextId(id)
                    onEditText?.(id)
                  }}
                  registerRef={registerRef}
                />
              ) : (
                <EpkCanvasElementNode
                  key={element.id}
                  element={element}
                  listening
                  isSelected={selectedIds.includes(element.id)}
                  onSelect={handleSelect}
                  onChange={updateElement}
                  onDoubleClickText={(id) => {
                    setEditingTextId(id)
                    onEditText?.(id)
                  }}
                  registerRef={registerRef}
                />
              ),
            )}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={Boolean(selectedImageElement)}
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
                'middle-left',
                'middle-right',
                'top-center',
                'bottom-center',
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 8 || newBox.height < 8) return oldBox
                return newBox
              }}
              animationDuration={prefersReducedMotion ? 0 : undefined}
            />
          </Layer>
        </Stage>

        {editingElement?.type === 'text' && (
          <EpkTextEditor
            element={editingElement}
            zoom={zoom}
            onChange={(content) => updateElement(editingElement.id, { content })}
            onClose={() => setEditingTextId(null)}
          />
        )}
      </div>
      {contextMenu && (onOpenAssetPicker || onReplaceImage) ? (
        <EpkCanvasContextMenu
          anchor={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenAssetPicker={onOpenAssetPicker ?? (() => {})}
          onReplaceImage={onReplaceImage}
          onEditText={(id) => {
            setEditingTextId(id)
            onEditText?.(id)
          }}
        />
      ) : null}
    </div>
  )
}
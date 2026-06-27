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
import { EpkCanvasElementNode } from './EpkCanvasElementNode'
import { EpkGroupNode } from './EpkGroupNode'
import { EpkTextEditor } from './EpkTextEditor'

interface EpkCanvasProps {
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

export function EpkCanvas({ onEditText }: EpkCanvasProps = {}) {
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
  const transformerRef = useRef<Konva.Transformer>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)

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
          width={stageWidth}
          height={stageHeight}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) {
              clearSelection()
              setEditingTextId(null)
            }
          }}
          onTouchStart={(e) => {
            if (e.target === e.target.getStage()) {
              clearSelection()
              setEditingTextId(null)
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
    </div>
  )
}
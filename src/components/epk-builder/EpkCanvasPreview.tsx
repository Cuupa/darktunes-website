'use client'

/**
 * src/components/epk-builder/EpkCanvasPreview.tsx
 *
 * Read-only Konva canvas preview of an EpkDocumentV2 document.
 */

import '@/lib/epk/konvaShapes'
import { useMemo } from 'react'
import { Stage, Layer } from 'react-konva'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { getTopLevelPageElements } from '@/lib/epk/elements/groupUtils'
import { EpkCanvasElementNode } from './EpkCanvasElementNode'
import { EpkGroupNode } from './EpkGroupNode'
import { EpkPageBackgroundLayer } from './EpkPageBackgroundLayer'

interface EpkCanvasPreviewProps {
  document: EpkDocumentV2
  scale?: number
  className?: string
}

export function EpkCanvasPreview({ document, scale = 0.55, className }: EpkCanvasPreviewProps) {
  const page = document.pages[0]
  const pageId = page?.id
  const elements = useMemo(
    () => (pageId ? getTopLevelPageElements(document, pageId) : []),
    [document, pageId],
  )

  if (!page) return null

  const stageWidth = page.width * scale
  const stageHeight = page.height * scale

  return (
    <div
      className={className}
      style={{ width: stageWidth, height: stageHeight }}
      aria-label="EPK canvas preview"
    >
      <Stage
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        listening={false}
      >
        <Layer listening={false}>
          <EpkPageBackgroundLayer page={page} />
          {elements.map((element) =>
            element.type === 'group' ? (
              <EpkGroupNode key={element.id} document={document} element={element} listening={false} />
            ) : (
              <EpkCanvasElementNode key={element.id} element={element} listening={false} />
            ),
          )}
        </Layer>
      </Stage>
    </div>
  )
}
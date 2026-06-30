'use client'

/**
 * src/components/epk-builder/EpkPublicViewer.tsx
 *
 * Read-only multi-page EPK canvas viewer for press pages and share links.
 */

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { EpkFontFaces } from './EpkFontFaces'

const EpkCanvasPreview = dynamic(
  () => import('./EpkCanvasPreview').then((m) => m.EpkCanvasPreview),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-lg border border-border bg-muted/40" />
    ),
  },
)

interface EpkPublicViewerProps {
  document: EpkDocumentV2
  artistName: string
  className?: string
  labels?: {
    previousPage: string
    nextPage: string
    pageIndicator: string
    viewerLabel: string
  }
}

export function EpkPublicViewer({
  document,
  artistName,
  className,
  labels,
}: EpkPublicViewerProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const page = document.pages[pageIndex]
  const pageCount = document.pages.length

  const pageDocument = useMemo((): EpkDocumentV2 | null => {
    if (!page) return null
    return {
      ...document,
      pages: [page],
      elements: document.elements.filter((el) => el.pageId === page.id),
    }
  }, [document, page])

  if (!page || !pageDocument) return null

  const indicator = (labels?.pageIndicator ?? 'Page {current} of {total}')
    .replace('{current}', String(pageIndex + 1))
    .replace('{total}', String(pageCount))

  return (
    <section
      className={cn('space-y-4', className)}
      aria-label={labels?.viewerLabel ?? `${artistName} press kit`}
    >
      <EpkFontFaces fonts={document.fonts} styleId="epk-public-font-faces" />
      <div className="flex flex-col items-center gap-4">
        <EpkCanvasPreview document={pageDocument} scale={0.65} className="mx-auto" />
        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] min-w-[44px]"
              disabled={pageIndex === 0}
              aria-label={labels?.previousPage ?? 'Previous page'}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            >
              <CaretLeft size={18} aria-hidden="true" />
            </Button>
            <p className="text-sm text-muted-foreground">{indicator}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] min-w-[44px]"
              disabled={pageIndex >= pageCount - 1}
              aria-label={labels?.nextPage ?? 'Next page'}
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
            >
              <CaretRight size={18} aria-hidden="true" />
            </Button>
          </div>
        )}
        {page.name && (
          <p className="text-sm font-medium text-muted-foreground">{page.name}</p>
        )}
      </div>
    </section>
  )
}
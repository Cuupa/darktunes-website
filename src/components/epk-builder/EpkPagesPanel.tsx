'use client'

/**
 * src/components/epk-builder/EpkPagesPanel.tsx
 *
 * Multi-page navigation and management for the EPK canvas editor.
 */

import { Copy, Plus, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import type { Dictionary } from '@/i18n/types'

interface EpkPagesPanelProps {
  dict: Dictionary['portal']
}

export function EpkPagesPanel({ dict }: EpkPagesPanelProps) {
  const pages = useEpkEditorStore((s) => s.document.pages)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const setActivePageId = useEpkEditorStore((s) => s.setActivePageId)
  const addPage = useEpkEditorStore((s) => s.addPage)
  const removePage = useEpkEditorStore((s) => s.removePage)
  const duplicatePage = useEpkEditorStore((s) => s.duplicatePage)
  const renamePage = useEpkEditorStore((s) => s.renamePage)

  const activeIndex = pages.findIndex((p) => p.id === activePageId)

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{dict.epk_pages_title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dict.epk_pages_count
              .replace('{current}', String(activeIndex + 1))
              .replace('{total}', String(pages.length))}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] min-w-[44px]"
          aria-label={dict.epk_pages_add}
          onClick={() => addPage()}
        >
          <Plus size={18} aria-hidden="true" />
        </Button>
      </div>

      <ul className="space-y-2 p-4 max-h-[min(240px,35vh)] overflow-y-auto list-none">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId
          return (
            <li key={page.id}>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 transition-colors',
                  isActive ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <button
                  type="button"
                  className="flex-1 min-h-[44px] text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1"
                  aria-pressed={isActive}
                  onClick={() => setActivePageId(page.id)}
                >
                  <span className="font-medium">{page.name ?? `Page ${index + 1}`}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  aria-label={dict.epk_pages_duplicate}
                  onClick={() => duplicatePage(page.id)}
                >
                  <Copy size={16} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] shrink-0"
                  disabled={pages.length <= 1}
                  aria-label={dict.epk_pages_delete}
                  onClick={() => removePage(page.id)}
                >
                  <Trash size={16} aria-hidden="true" />
                </Button>
              </div>
              {isActive && (
                <div className="mt-2 px-1">
                  <Input
                    value={page.name ?? ''}
                    placeholder={dict.epk_pages_name_placeholder}
                    aria-label={dict.epk_pages_rename}
                    onChange={(e) => renamePage(page.id, e.target.value)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
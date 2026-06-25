'use client'

/**
 * src/components/epk-builder/EpkLayersPanel.tsx
 */

import { useTranslations } from 'next-intl'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import type { EpkElement } from '@/lib/epk/schema/documentV2'

function layerLabel(element: EpkElement): string {
  if (element.role) return element.role
  if (element.type === 'text') return element.content?.slice(0, 24) || 'Text'
  if (element.type === 'image' || element.type === 'logo') return 'Image'
  if (element.type === 'group') return `Group (${element.children?.length ?? 0})`
  return element.type
}

export function EpkLayersPanel() {
  const t = useTranslations('portal')
  const document = useEpkEditorStore((s) => s.document)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const selectElements = useEpkEditorStore((s) => s.selectElements)
  const moveElementZ = useEpkEditorStore((s) => s.moveElementZ)
  const toggleElementVisibility = useEpkEditorStore((s) => s.toggleElementVisibility)
  const toggleElementLock = useEpkEditorStore((s) => s.toggleElementLock)

  const layers = document.elements
    .filter((el) => el.pageId === activePageId)
    .sort((a, b) => b.zIndex - a.zIndex)

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('epk_editor_layers_title')}</h2>
      </div>
      <ScrollArea className="h-[min(280px,40vh)]" data-lenis-prevent>
        <ul className="p-2 space-y-1" aria-label={t('epk_editor_layers_title')}>
          {layers.map((element) => {
            const isSelected = selectedIds.includes(element.id)
            return (
              <li key={element.id}>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
                    isSelected && 'bg-primary/15 ring-1 ring-primary/40',
                  )}
                >
                  <button
                    type="button"
                    className="flex-1 truncate text-left hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    onClick={() => selectElements([element.id])}
                  >
                    <span className="text-muted-foreground mr-1 uppercase text-[10px]">
                      {element.type}
                    </span>
                    {layerLabel(element)}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                    aria-label={element.visible ? t('epk_editor_hide_layer') : t('epk_editor_show_layer')}
                    aria-pressed={element.visible}
                    onClick={() => toggleElementVisibility(element.id)}
                  >
                    {element.visible ? (
                      <Eye size={16} aria-hidden="true" />
                    ) : (
                      <EyeSlash size={16} aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                    aria-label={element.locked ? t('epk_editor_unlock_layer') : t('epk_editor_lock_layer')}
                    aria-pressed={element.locked}
                    onClick={() => toggleElementLock(element.id)}
                  >
                    {element.locked ? (
                      <Lock size={16} aria-hidden="true" />
                    ) : (
                      <LockOpen size={16} aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                    aria-label={t('epk_editor_layer_up')}
                    onClick={() => moveElementZ(element.id, 'up')}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] shrink-0"
                    aria-label={t('epk_editor_layer_down')}
                    onClick={() => moveElementZ(element.id, 'down')}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
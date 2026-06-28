'use client'

/**
 * src/components/epk-builder/EpkLayersPanel.tsx
 */

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ArrowDown,
  ArrowUp,
  DotsSixVertical,
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
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

interface LayerRowProps {
  element: EpkElement
  isSelected: boolean
  isDragging: boolean
  isDropTarget: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
  hideLayerLabel: string
  showLayerLabel: string
  lockLayerLabel: string
  unlockLayerLabel: string
  layerUpLabel: string
  layerDownLabel: string
  dragHandleLabel: string
}

function LayerRow({
  element,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  hideLayerLabel,
  showLayerLabel,
  lockLayerLabel,
  unlockLayerLabel,
  layerUpLabel,
  layerDownLabel,
  dragHandleLabel,
}: LayerRowProps) {
  return (
    <li
      className={cn(
        'relative rounded-md transition-colors',
        isDragging && 'opacity-40',
        isDropTarget && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-card',
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-md px-1 py-1 text-sm',
          isSelected && 'bg-primary/15 ring-1 ring-primary/40',
          !element.visible && 'opacity-60',
        )}
      >
        <button
          type="button"
          draggable
          className="flex min-h-[44px] min-w-[32px] shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          aria-label={dragHandleLabel}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', element.id)
            onDragStart()
          }}
          onDragEnd={onDragEnd}
        >
          <DotsSixVertical size={16} aria-hidden="true" weight="bold" />
        </button>
        <button
          type="button"
          className="flex-1 truncate text-left hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 min-h-[44px]"
          onClick={onSelect}
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
          aria-label={element.visible ? hideLayerLabel : showLayerLabel}
          aria-pressed={element.visible}
          onClick={onToggleVisibility}
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
          aria-label={element.locked ? unlockLayerLabel : lockLayerLabel}
          aria-pressed={element.locked}
          onClick={onToggleLock}
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
          aria-label={layerUpLabel}
          onClick={onMoveUp}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] shrink-0"
          aria-label={layerDownLabel}
          onClick={onMoveDown}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}

export function EpkLayersPanel() {
  const t = useTranslations('portal')
  const document = useEpkEditorStore((s) => s.document)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const selectElements = useEpkEditorStore((s) => s.selectElements)
  const moveElementZ = useEpkEditorStore((s) => s.moveElementZ)
  const reorderElementLayers = useEpkEditorStore((s) => s.reorderElementLayers)
  const toggleElementVisibility = useEpkEditorStore((s) => s.toggleElementVisibility)
  const toggleElementLock = useEpkEditorStore((s) => s.toggleElementLock)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const layers = document.elements
    .filter((el) => el.pageId === activePageId)
    .sort((a, b) => b.zIndex - a.zIndex)

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!draggedId || draggedId === targetId) {
        setDraggedId(null)
        setDropTargetId(null)
        return
      }

      const currentIds = layers.map((el) => el.id)
      const fromIndex = currentIds.indexOf(draggedId)
      const toIndex = currentIds.indexOf(targetId)
      if (fromIndex === -1 || toIndex === -1) {
        setDraggedId(null)
        setDropTargetId(null)
        return
      }

      const next = [...currentIds]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      reorderElementLayers(next)

      setDraggedId(null)
      setDropTargetId(null)
    },
    [draggedId, layers, reorderElementLayers],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('epk_editor_layers_title')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('epk_editor_layers_count', { count: layers.length })}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" data-lenis-prevent>
        {layers.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            {t('epk_editor_layers_empty')}
          </p>
        ) : (
          <ul className="space-y-1" aria-label={t('epk_editor_layers_title')}>
            {layers.map((element) => {
              const isSelected = selectedIds.includes(element.id)
              return (
                <LayerRow
                  key={element.id}
                  element={element}
                  isSelected={isSelected}
                  isDragging={draggedId === element.id}
                  isDropTarget={dropTargetId === element.id && draggedId !== element.id}
                  onSelect={() => selectElements([element.id])}
                  onToggleVisibility={() => toggleElementVisibility(element.id)}
                  onToggleLock={() => toggleElementLock(element.id)}
                  onMoveUp={() => moveElementZ(element.id, 'up')}
                  onMoveDown={() => moveElementZ(element.id, 'down')}
                  onDragStart={() => setDraggedId(element.id)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropTargetId(element.id)
                  }}
                  onDrop={() => handleDrop(element.id)}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDropTargetId(null)
                  }}
                  hideLayerLabel={t('epk_editor_hide_layer')}
                  showLayerLabel={t('epk_editor_show_layer')}
                  lockLayerLabel={t('epk_editor_lock_layer')}
                  unlockLayerLabel={t('epk_editor_unlock_layer')}
                  layerUpLabel={t('epk_editor_layer_up')}
                  layerDownLabel={t('epk_editor_layer_down')}
                  dragHandleLabel={t('epk_editor_layer_drag_handle')}
                />
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
'use client'

/**
 * src/components/epk-builder/EpkToolbar.tsx
 */

import { useTranslations } from 'next-intl'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  TextT,
  Square,
  Image as ImageIcon,
  Trash,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  FloppyDisk,
  ClockCounterClockwise,
  BookmarkSimple,
  SquaresFour,
  SquareHalf,
  Link as LinkIcon,
  ChartBar,
  Layout,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEpkEditorStore, useEpkEditorStoreApi, useEpkEditorTemporal } from '@/lib/epk/editor/EpkEditorProvider'

interface EpkToolbarProps {
  onSave: () => void
  onSaveSnapshot: () => void
  onOpenAssetPicker: () => void
  onOpenVersionHistory: () => void
  onOpenShareLinks: () => void
  onOpenAnalytics: () => void
  onOpenTemplates: () => void
  isSaving: boolean
}

export function EpkToolbar({
  onSave,
  onSaveSnapshot,
  onOpenAssetPicker,
  onOpenVersionHistory,
  onOpenShareLinks,
  onOpenAnalytics,
  onOpenTemplates,
  isSaving,
}: EpkToolbarProps) {
  const t = useTranslations('portal')
  const store = useEpkEditorStoreApi()
  const addElement = useEpkEditorStore((s) => s.addElement)
  const deleteSelected = useEpkEditorStore((s) => s.deleteSelected)
  const groupSelected = useEpkEditorStore((s) => s.groupSelected)
  const ungroupSelected = useEpkEditorStore((s) => s.ungroupSelected)
  const setZoom = useEpkEditorStore((s) => s.setZoom)
  const zoom = useEpkEditorStore((s) => s.zoom)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const isDirty = useEpkEditorStore((s) => s.isDirty)

  const pastStates = useEpkEditorTemporal((s) => s.pastStates)
  const futureStates = useEpkEditorTemporal((s) => s.futureStates)

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
      role="toolbar"
      aria-label={t('epk_editor_toolbar_label')}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        disabled={!canUndo}
        aria-label={t('epk_editor_undo')}
        onClick={() => store.temporal.getState().undo()}
      >
        <ArrowCounterClockwise size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        disabled={!canRedo}
        aria-label={t('epk_editor_redo')}
        onClick={() => store.temporal.getState().redo()}
      >
        <ArrowClockwise size={18} aria-hidden="true" />
      </Button>

      <Separator orientation="vertical" className="h-8 hidden sm:block" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={() => addElement('text')}
      >
        <TextT size={18} className="mr-2" aria-hidden="true" />
        {t('epk_editor_add_text')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={() => addElement('shape')}
      >
        <Square size={18} className="mr-2" aria-hidden="true" />
        {t('epk_editor_add_shape')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={onOpenAssetPicker}
      >
        <ImageIcon size={18} className="mr-2" aria-hidden="true" />
        {t('epk_editor_add_image')}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        disabled={selectedIds.length === 0}
        aria-label={t('epk_editor_delete')}
        onClick={() => deleteSelected()}
      >
        <Trash size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        disabled={selectedIds.length < 2}
        aria-label={t('epk_editor_group')}
        onClick={() => groupSelected()}
      >
        <SquaresFour size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        disabled={selectedIds.length === 0}
        aria-label={t('epk_editor_ungroup')}
        onClick={() => ungroupSelected()}
      >
        <SquareHalf size={18} aria-hidden="true" />
      </Button>

      <Separator orientation="vertical" className="h-8 hidden sm:block" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_editor_zoom_out')}
        onClick={() => setZoom(zoom - 0.1)}
      >
        <MagnifyingGlassMinus size={18} aria-hidden="true" />
      </Button>
      <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_editor_zoom_in')}
        onClick={() => setZoom(zoom + 0.1)}
      >
        <MagnifyingGlassPlus size={18} aria-hidden="true" />
      </Button>

      <div className="flex-1" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        aria-label={t('epk_versions_snapshot')}
        onClick={() => void onSaveSnapshot()}
        disabled={isSaving}
      >
        <BookmarkSimple size={18} className="mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">{t('epk_versions_snapshot')}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_versions_title')}
        onClick={onOpenVersionHistory}
      >
        <ClockCounterClockwise size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_share_title')}
        onClick={onOpenShareLinks}
      >
        <LinkIcon size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_analytics_title')}
        onClick={onOpenAnalytics}
      >
        <ChartBar size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={t('epk_templates_title')}
        onClick={onOpenTemplates}
      >
        <Layout size={18} aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-[44px]"
        disabled={!isDirty || isSaving}
        onClick={() => void onSave()}
      >
        <FloppyDisk size={18} className="mr-2" aria-hidden="true" />
        {isSaving ? t('epk_editor_saving') : t('epk_editor_save')}
      </Button>
    </div>
  )
}
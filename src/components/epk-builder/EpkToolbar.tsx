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
  Plus,
  GridFour,
  Magnet,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEpkEditorStore, useEpkEditorStoreApi, useEpkEditorTemporal } from '@/lib/epk/editor/EpkEditorProvider'
import { PROFILE_PRESETS, type ProfilePresetId } from '@/lib/epk/editor/profilePresets'
import { EpkColorThemePicker } from './EpkColorThemePicker'
import { EpkHelpDialog } from './EpkHelpDialog'

interface EpkToolbarProps {
  onSave: () => void
  onSaveSnapshot: () => void
  onOpenAssetPicker: () => void
  onOpenVersionHistory: () => void
  onOpenShareLinks: () => void
  onOpenAnalytics: () => void
  onOpenTemplates: () => void
  onOpenCommandPalette: () => void
  onInsertPreset: (presetId: ProfilePresetId) => void
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
  onOpenCommandPalette,
  onInsertPreset,
  isSaving,
}: EpkToolbarProps) {
  const t = useTranslations('portal')
  const store = useEpkEditorStoreApi()
  const addElement = useEpkEditorStore((s) => s.addElement)
  const deleteSelected = useEpkEditorStore((s) => s.deleteSelected)
  const groupSelected = useEpkEditorStore((s) => s.groupSelected)
  const ungroupSelected = useEpkEditorStore((s) => s.ungroupSelected)
  const document = useEpkEditorStore((s) => s.document)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const setZoom = useEpkEditorStore((s) => s.setZoom)
  const zoom = useEpkEditorStore((s) => s.zoom)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const isDirty = useEpkEditorStore((s) => s.isDirty)
  const snapEnabled = useEpkEditorStore((s) => s.snapEnabled)
  const showGrid = useEpkEditorStore((s) => s.showGrid)
  const setSnapEnabled = useEpkEditorStore((s) => s.setSnapEnabled)
  const setShowGrid = useEpkEditorStore((s) => s.setShowGrid)

  const pastStates = useEpkEditorTemporal((s) => s.pastStates)
  const futureStates = useEpkEditorTemporal((s) => s.futureStates)

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  const presetLabel = (id: ProfilePresetId): string => {
    switch (id) {
      case 'bio-short':
        return t('epk_preset_bio_short')
      case 'bio-long':
        return t('epk_preset_bio_long')
      case 'social-links':
        return t('epk_preset_social')
      case 'contacts':
        return t('epk_preset_contacts')
      case 'press-quote':
        return t('epk_preset_quote')
      case 'artist-info':
        return t('epk_preset_info')
      default:
        return id
    }
  }

  const fitPageZoom = () => {
    const page = document.pages.find((p) => p.id === activePageId) ?? document.pages[0]
    if (!page) return
    const sidebarWidth = window.innerWidth >= 1280 ? 560 : window.innerWidth >= 1024 ? 520 : 0
    const availableWidth = Math.max(320, window.innerWidth - sidebarWidth - 80)
    const availableHeight = Math.max(320, window.innerHeight - 200)
    const fitByWidth = availableWidth / page.width
    const fitByHeight = availableHeight / page.height
    setZoom(Math.min(2.5, Math.max(0.1, Math.min(fitByWidth, fitByHeight))))
  }

  return (
    <TooltipProvider>
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
      role="toolbar"
      aria-label={t('epk_editor_toolbar_label')}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] min-w-[44px]"
            aria-label={t('epk_cmd_title')}
            onClick={onOpenCommandPalette}
          >
            <MagnifyingGlass size={18} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('epk_cmd_tooltip')}</TooltipContent>
      </Tooltip>
      <EpkHelpDialog />

      <Separator orientation="vertical" className="h-8 hidden sm:block" />

      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>{t('epk_editor_undo')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>{t('epk_editor_redo')}</TooltipContent>
      </Tooltip>

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
        <span className="hidden sm:inline">{t('epk_editor_add_image')}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
            <Plus size={18} className="mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">{t('epk_preset_menu')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {PROFILE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onInsertPreset(preset.id)}
            >
              {presetLabel(preset.id)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
        variant={snapEnabled ? 'secondary' : 'outline'}
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={snapEnabled ? t('epk_ctx_snap_off') : t('epk_ctx_snap_on')}
        aria-pressed={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
      >
        <Magnet size={18} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant={showGrid ? 'secondary' : 'outline'}
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        aria-label={showGrid ? t('epk_ctx_grid_off') : t('epk_ctx_grid_on')}
        aria-pressed={showGrid}
        onClick={() => setShowGrid(!showGrid)}
      >
        <GridFour size={18} aria-hidden="true" />
      </Button>

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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-[44px]"
        onClick={fitPageZoom}
      >
        {t('epk_editor_zoom_fit')}
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
      <EpkColorThemePicker />

      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>{t('epk_templates_title')}</TooltipContent>
      </Tooltip>

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
    </TooltipProvider>
  )
}
'use client'

import { useTranslations } from 'next-intl'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ClockCounterClockwise,
  Command,
  DeviceMobile,
  Desktop,
  Eye,
  RocketLaunch,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useFanPageEditorStore,
  useFanPageEditorStoreApi,
  useFanPageEditorTemporal,
} from '@/lib/fan-page/editor/FanPageEditorProvider'
import { FanPageSaveStatus } from './FanPageSaveStatus'
import { FAN_PAGE_OPEN_COMMAND_PALETTE_EVENT } from './FanPageCommandPalette'
import type { FanPageSaveStatus as SaveStatus } from '@/hooks/useFanPageAutosave'

interface FanPageToolbarProps {
  onPublish: (mode: 'submit_review' | 'publish_direct') => void
  onOpenHistory: () => void
  onOpenSmartPreview: () => void
  isPublishing: boolean
  canPublishDirect: boolean
  publishStatus: string
  saveStatus: SaveStatus
  isDirty: boolean
  isPreviewLoading?: boolean
}

export function FanPageToolbar({
  onPublish,
  onOpenHistory,
  onOpenSmartPreview,
  isPublishing,
  canPublishDirect,
  publishStatus,
  saveStatus,
  isDirty,
  isPreviewLoading = false,
}: FanPageToolbarProps) {
  const t = useTranslations('portal')
  const store = useFanPageEditorStoreApi()
  const previewDevice = useFanPageEditorStore((s) => s.previewDevice)
  const setPreviewDevice = useFanPageEditorStore((s) => s.setPreviewDevice)

  const pastStates = useFanPageEditorTemporal((s) => s.pastStates)
  const futureStates = useFanPageEditorTemporal((s) => s.futureStates)

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label={t('fanPage_toolbar_label')}
    >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={pastStates.length === 0}
              onClick={() => store.temporal.getState().undo()}
              aria-label={t('fanPage_undo')}
            >
              <ArrowCounterClockwise size={18} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fanPage_undo')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={futureStates.length === 0}
              onClick={() => store.temporal.getState().redo()}
              aria-label={t('fanPage_redo')}
            >
              <ArrowClockwise size={18} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fanPage_redo')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={pastStates.length === 0}
              onClick={onOpenHistory}
              aria-label={t('fanPage_history_title')}
            >
              <ClockCounterClockwise size={18} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fanPage_history_title')}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          type="button"
          variant={previewDevice === 'desktop' ? 'default' : 'outline'}
          size="sm"
          className="min-h-[36px]"
          onClick={() => setPreviewDevice('desktop')}
        >
          <Desktop size={16} className="mr-1.5" aria-hidden />
          {t('fanPage_device_desktop')}
        </Button>
        <Button
          type="button"
          variant={previewDevice === 'mobile' ? 'default' : 'outline'}
          size="sm"
          className="min-h-[36px]"
          onClick={() => setPreviewDevice('mobile')}
        >
          <DeviceMobile size={16} className="mr-1.5" aria-hidden />
          {t('fanPage_device_mobile')}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[36px]"
              disabled={isPreviewLoading || saveStatus === 'saving' || saveStatus === 'pending'}
              onClick={onOpenSmartPreview}
            >
              <Eye size={16} className="mr-1.5" aria-hidden />
              {isPreviewLoading ? t('fanPage_preview_opening') : t('fanPage_smart_preview')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fanPage_smart_preview_hint')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(FAN_PAGE_OPEN_COMMAND_PALETTE_EVENT))
              }
              aria-label={t('fanPage_cmd_tooltip')}
            >
              <Command size={18} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fanPage_cmd_tooltip')}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" className="min-h-[36px]" disabled={isPublishing}>
              <RocketLaunch size={16} className="mr-1.5" aria-hidden />
              {isPublishing ? t('fanPage_publishing') : t('fanPage_publish')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onPublish('submit_review')}>
              {t('fanPage_publish_review')}
            </DropdownMenuItem>
            {canPublishDirect ? (
              <DropdownMenuItem onSelect={() => onPublish('publish_direct')}>
                {t('fanPage_publish_direct')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <FanPageSaveStatus status={saveStatus} isDirty={isDirty} className="ml-auto" />

        <span className="text-xs text-muted-foreground capitalize">
          {publishStatus.replace(/_/g, ' ')}
        </span>
    </div>
  )
}
'use client'

import { useTranslations } from 'next-intl'
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  DeviceMobile,
  Desktop,
  FloppyDisk,
  RocketLaunch,
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
import { useFanPageEditorStore, useFanPageEditorStoreApi, useFanPageEditorTemporal } from '@/lib/fan-page/editor/FanPageEditorProvider'

interface FanPageToolbarProps {
  onSave: () => void
  onPublish: (mode: 'submit_review' | 'publish_direct') => void
  isSaving: boolean
  isPublishing: boolean
  canPublishDirect: boolean
  publishStatus: string
}

export function FanPageToolbar({
  onSave,
  onPublish,
  isSaving,
  isPublishing,
  canPublishDirect,
  publishStatus,
}: FanPageToolbarProps) {
  const t = useTranslations('portal')
  const store = useFanPageEditorStoreApi()
  const previewDevice = useFanPageEditorStore((s) => s.previewDevice)
  const setPreviewDevice = useFanPageEditorStore((s) => s.setPreviewDevice)
  const isDirty = useFanPageEditorStore((s) => s.isDirty)

  const pastStates = useFanPageEditorTemporal((s) => s.pastStates)
  const futureStates = useFanPageEditorTemporal((s) => s.futureStates)

  return (
    <TooltipProvider>
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

        <Button
          type="button"
          size="sm"
          className="min-h-[36px]"
          disabled={isSaving || !isDirty}
          onClick={onSave}
        >
          <FloppyDisk size={16} className="mr-1.5" aria-hidden />
          {isSaving ? t('fanPage_saving') : t('fanPage_save')}
        </Button>

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

        <span className="ml-auto text-xs text-muted-foreground capitalize">
          {publishStatus.replace(/_/g, ' ')}
        </span>
      </div>
    </TooltipProvider>
  )
}
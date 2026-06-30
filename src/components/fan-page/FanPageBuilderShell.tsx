'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDefaultLayout } from 'react-resizable-panels'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useFanPageEditorStoreApi } from '@/lib/fan-page/editor/FanPageEditorProvider'
import { FanPageToolbar } from './FanPageToolbar'
import { FanPageBlockLibrary } from './FanPageBlockLibrary'
import { FanPageCanvas } from './FanPageCanvas'
import { FanPagePreviewPanel } from './FanPagePreviewPanel'
import { FanPagePropertiesPanel } from './FanPagePropertiesPanel'
import { FanPageThemePanel } from './FanPageThemePanel'
import type { FanPageLiveData } from './FanPageBlockRenderer'
import { cn } from '@/lib/utils'

type MobilePanel = 'sections' | 'preview' | 'properties'

interface FanPageBuilderShellProps {
  artistId: string
  liveData: FanPageLiveData
  onSave: () => void
  onPublish: (mode: 'submit_review' | 'publish_direct') => void
  isSaving: boolean
  isPublishing: boolean
  canPublishDirect: boolean
  publishStatus: string
}

export function FanPageBuilderShell({
  artistId,
  liveData,
  onSave,
  onPublish,
  isSaving,
  isPublishing,
  canPublishDirect,
  publishStatus,
}: FanPageBuilderShellProps) {
  const t = useTranslations('portal')
  const store = useFanPageEditorStoreApi()
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('preview')

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'fan-page-builder-layout-v1',
    panelIds: ['fan-left-panel', 'fan-preview-panel', 'fan-right-panel'],
    storage: localStorage,
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.temporal.getState().undo()
      } else if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        store.temporal.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store])

  const leftPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" data-lenis-prevent>
      <FanPageBlockLibrary />
      <FanPageCanvas />
    </div>
  )

  const rightPanel = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-lenis-prevent>
      <FanPagePropertiesPanel artistId={artistId} />
      <FanPageThemePanel />
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[560px] flex-col md:h-[calc(100dvh-0px)]">
      <div className="shrink-0 border-b border-border bg-card px-3 py-2 md:px-4">
        <FanPageToolbar
          onSave={onSave}
          onPublish={onPublish}
          isSaving={isSaving}
          isPublishing={isPublishing}
          canPublishDirect={canPublishDirect}
          publishStatus={publishStatus}
        />
      </div>

      <nav
        className="flex shrink-0 gap-1 border-b border-border bg-card p-2 lg:hidden"
        aria-label={t('fanPage_mobile_nav')}
      >
        {(['sections', 'preview', 'properties'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            className={cn(
              'min-h-[44px] flex-1 rounded-md px-3 text-sm font-medium transition-colors',
              mobilePanel === panel
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setMobilePanel(panel)}
          >
            {panel === 'sections'
              ? t('fanPage_mobile_sections')
              : panel === 'preview'
                ? t('fanPage_preview_title')
                : t('fanPage_properties_title')}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-r border-border bg-card lg:hidden',
            mobilePanel !== 'sections' && 'hidden',
          )}
        >
          {leftPanel}
        </aside>

        <main
          className={cn('min-w-0 flex-1 overflow-hidden lg:hidden', mobilePanel !== 'preview' && 'hidden')}
        >
          <FanPagePreviewPanel liveData={liveData} />
        </main>

        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-l border-border bg-card lg:hidden',
            mobilePanel !== 'properties' && 'hidden',
          )}
        >
          {rightPanel}
        </aside>

        <ResizablePanelGroup
          direction="horizontal"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
          className="hidden min-h-0 flex-1 lg:flex"
        >
          <ResizablePanel id="fan-left-panel" defaultSize="20%" minSize="14%" maxSize="30%" className="min-w-0">
            <aside className="flex h-full flex-col border-r border-border bg-card">{leftPanel}</aside>
          </ResizablePanel>

          <ResizableHandle withHandle aria-label={t('fanPage_panel_resize')} className="bg-border" />

          <ResizablePanel id="fan-preview-panel" defaultSize="50%" minSize="35%" className="min-w-0">
            <main className="h-full overflow-hidden">
              <FanPagePreviewPanel liveData={liveData} />
            </main>
          </ResizablePanel>

          <ResizableHandle withHandle aria-label={t('fanPage_panel_resize')} className="bg-border" />

          <ResizablePanel id="fan-right-panel" defaultSize="30%" minSize="18%" maxSize="42%" className="min-w-0">
            <aside className="flex h-full flex-col border-l border-border bg-card">{rightPanel}</aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
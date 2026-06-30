'use client'

import { useTranslations } from 'next-intl'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import { FanPageBlockRenderer, type FanPageLiveData } from './FanPageBlockRenderer'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import { cn } from '@/lib/utils'

interface FanPagePreviewPanelProps {
  liveData: FanPageLiveData
}

export function FanPagePreviewPanel({ liveData }: FanPagePreviewPanelProps) {
  const t = useTranslations('portal')
  const document = useFanPageEditorStore((s) => s.document)
  const previewDevice = useFanPageEditorStore((s) => s.previewDevice)
  const selectedSectionId = useFanPageEditorStore((s) => s.selectedSectionId)
  const selectSection = useFanPageEditorStore((s) => s.selectSection)

  const colors = resolveThemeColors(document.theme)
  const sections = [...document.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-2">
        <h2 className="text-sm font-semibold">{t('fanPage_preview_title')}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4" data-lenis-prevent>
        <div
          className={cn(
            'mx-auto overflow-hidden rounded-lg border border-border shadow-lg transition-all',
            previewDevice === 'mobile' ? 'max-w-[390px]' : 'max-w-4xl',
          )}
          style={{ backgroundColor: colors.background, color: colors.text }}
        >
          {sections.map((section) => (
            <FanPageBlockRenderer
              key={section.id}
              section={section}
              theme={document.theme}
              device={previewDevice}
              liveData={liveData}
              selected={selectedSectionId === section.id}
              onSelect={selectSection}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
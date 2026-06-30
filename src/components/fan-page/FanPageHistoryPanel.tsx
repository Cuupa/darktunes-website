'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  useFanPageEditorStore,
  useFanPageEditorStoreApi,
  useFanPageEditorTemporal,
} from '@/lib/fan-page/editor/FanPageEditorProvider'
import { describeDocumentChange } from '@/lib/fan-page/editor/historyLabels'
import { portalKey } from '@/i18n/portalKey'

interface FanPageHistoryPanelProps {
  open: boolean
  onClose: () => void
}

export function FanPageHistoryPanel({ open, onClose }: FanPageHistoryPanelProps) {
  const t = useTranslations('portal')
  const store = useFanPageEditorStoreApi()
  const document = useFanPageEditorStore((s) => s.document)
  const pastStates = useFanPageEditorTemporal((s) => s.pastStates)

  const entries = useMemo(() => {
    const length = pastStates.length
    return Array.from({ length }, (_, displayIndex) => {
      const before = pastStates[length - 1 - displayIndex]?.document
      const after =
        displayIndex === 0 ? document : pastStates[length - displayIndex]?.document
      if (!before || !after) return null
      const label = describeDocumentChange(before, after)
      return { displayIndex, label }
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }, [document, pastStates])

  const restoreTo = (displayIndex: number) => {
    const steps = displayIndex + 1
    for (let i = 0; i < steps; i++) {
      store.temporal.getState().undo()
    }
    onClose()
  }

  const formatLabel = (label: ReturnType<typeof describeDocumentChange>) => {
    if (label.blockKey) {
      return t(portalKey(label.key), { block: t(portalKey(label.blockKey)) })
    }
    return t(portalKey(label.key))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClockCounterClockwise size={20} aria-hidden />
            {t('fanPage_history_title')}
          </DialogTitle>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('fanPage_history_empty')}</p>
        ) : (
          <ul className="max-h-[min(60vh,400px)] space-y-1 overflow-y-auto" data-lenis-prevent>
            {entries.map(({ displayIndex, label }) => (
              <li key={displayIndex}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-[44px] w-full justify-start px-3 py-2 text-left text-sm font-normal"
                  onClick={() => restoreTo(displayIndex)}
                >
                  {formatLabel(label)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
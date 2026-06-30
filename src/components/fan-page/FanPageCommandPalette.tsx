'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import {
  useFanPageEditorStore,
  useFanPageEditorStoreApi,
} from '@/lib/fan-page/editor/FanPageEditorProvider'
import type { FanPageBlockType } from '@/lib/fan-page/schema/documentV1'
import { portalKey } from '@/i18n/portalKey'

export const FAN_PAGE_OPEN_COMMAND_PALETTE_EVENT = 'fan-page-open-command-palette'

const INSERT_BLOCKS: { type: FanPageBlockType; labelKey: string }[] = [
  { type: 'hero', labelKey: 'fanPage_block_hero' },
  { type: 'bio', labelKey: 'fanPage_block_bio' },
  { type: 'release_grid', labelKey: 'fanPage_block_releases' },
  { type: 'smart_links', labelKey: 'fanPage_block_links' },
  { type: 'cta_banner', labelKey: 'fanPage_block_cta' },
  { type: 'spacer', labelKey: 'fanPage_block_spacer' },
]

interface FanPageCommandPaletteProps {
  onOpenHistory: () => void
  onOpenSmartPreview: () => void
  onPublish: (mode: 'submit_review' | 'publish_direct') => void
  canPublishDirect: boolean
}

export function FanPageCommandPalette({
  onOpenHistory,
  onOpenSmartPreview,
  onPublish,
  canPublishDirect,
}: FanPageCommandPaletteProps) {
  const t = useTranslations('portal')
  const store = useFanPageEditorStoreApi()
  const [open, setOpen] = useState(false)
  const addSection = useFanPageEditorStore((s) => s.addSection)
  const removeSection = useFanPageEditorStore((s) => s.removeSection)
  const selectedSectionId = useFanPageEditorStore((s) => s.selectedSectionId)
  const setPreviewDevice = useFanPageEditorStore((s) => s.setPreviewDevice)
  const runAutoLayoutMobile = useFanPageEditorStore((s) => s.runAutoLayoutMobile)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(FAN_PAGE_OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(FAN_PAGE_OPEN_COMMAND_PALETTE_EVENT, onOpen)
    }
  }, [])

  const run = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('fanPage_cmd_title')}
      description={t('fanPage_cmd_description')}
    >
      <CommandInput placeholder={t('fanPage_cmd_search')} />
      <CommandList>
        <CommandEmpty>{t('fanPage_cmd_empty')}</CommandEmpty>
        <CommandGroup heading={t('fanPage_cmd_group_insert')}>
          {INSERT_BLOCKS.map(({ type, labelKey }) => (
            <CommandItem
              key={type}
              onSelect={() => run(() => addSection(type, selectedSectionId ?? undefined))}
            >
              {t(portalKey(labelKey))}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading={t('fanPage_cmd_group_edit')}>
          <CommandItem onSelect={() => run(() => store.temporal.getState().undo())}>
            {t('fanPage_undo')}
            <CommandShortcut>Ctrl+Z</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => store.temporal.getState().redo())}>
            {t('fanPage_redo')}
            <CommandShortcut>Ctrl+Y</CommandShortcut>
          </CommandItem>
          {selectedSectionId ? (
            <CommandItem onSelect={() => run(() => removeSection(selectedSectionId))}>
              {t('fanPage_delete_section')}
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => run(() => runAutoLayoutMobile())}>
            {t('fanPage_autolayout_mobile')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t('fanPage_cmd_group_view')}>
          <CommandItem onSelect={() => run(() => setPreviewDevice('desktop'))}>
            {t('fanPage_device_desktop')}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setPreviewDevice('mobile'))}>
            {t('fanPage_device_mobile')}
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenSmartPreview)}>
            {t('fanPage_smart_preview')}
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenHistory)}>
            {t('fanPage_history_title')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t('fanPage_cmd_group_publish')}>
          <CommandItem onSelect={() => run(() => onPublish('submit_review'))}>
            {t('fanPage_publish_review')}
          </CommandItem>
          {canPublishDirect ? (
            <CommandItem onSelect={() => run(() => onPublish('publish_direct'))}>
              {t('fanPage_publish_direct')}
            </CommandItem>
          ) : null}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
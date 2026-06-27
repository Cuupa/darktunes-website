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
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'
import type { ProfilePresetId } from '@/lib/epk/editor/profilePresets'

interface EpkCommandPaletteProps {
  onOpenAssetPicker: () => void
  onOpenTemplates: () => void
  onOpenVersionHistory: () => void
  onOpenShareLinks: () => void
  onInsertPreset: (presetId: ProfilePresetId) => void
  onSave: () => void
}

export const EPK_OPEN_COMMAND_PALETTE_EVENT = 'epk-open-command-palette'

export function EpkCommandPalette({
  onOpenAssetPicker,
  onOpenTemplates,
  onOpenVersionHistory,
  onOpenShareLinks,
  onInsertPreset,
  onSave,
}: EpkCommandPaletteProps) {
  const t = useTranslations('portal')
  const store = useEpkEditorStoreApi()
  const [open, setOpen] = useState(false)
  const addElement = useEpkEditorStore((s) => s.addElement)
  const deleteSelected = useEpkEditorStore((s) => s.deleteSelected)
  const duplicateSelected = useEpkEditorStore((s) => s.duplicateSelected)
  const groupSelected = useEpkEditorStore((s) => s.groupSelected)
  const setShowGrid = useEpkEditorStore((s) => s.setShowGrid)
  const setSnapEnabled = useEpkEditorStore((s) => s.setSnapEnabled)
  const showGrid = useEpkEditorStore((s) => s.showGrid)
  const snapEnabled = useEpkEditorStore((s) => s.snapEnabled)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(EPK_OPEN_COMMAND_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(EPK_OPEN_COMMAND_PALETTE_EVENT, onOpen)
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
      title={t('epk_cmd_title')}
      description={t('epk_cmd_description')}
    >
      <CommandInput placeholder={t('epk_cmd_search')} />
      <CommandList>
        <CommandEmpty>{t('epk_cmd_empty')}</CommandEmpty>
        <CommandGroup heading={t('epk_cmd_group_insert')}>
          <CommandItem onSelect={() => run(() => addElement('text'))}>
            {t('epk_editor_add_text')}
          </CommandItem>
          <CommandItem onSelect={() => run(() => addElement('shape'))}>
            {t('epk_editor_add_shape')}
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenAssetPicker)}>
            {t('epk_editor_add_image')}
          </CommandItem>
          <CommandItem onSelect={() => run(() => onInsertPreset('bio-short'))}>
            {t('epk_preset_bio_short')}
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenTemplates)}>
            {t('epk_templates_title')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t('epk_cmd_group_edit')}>
          <CommandItem onSelect={() => run(() => store.temporal.getState().undo())}>
            {t('epk_editor_undo')}
            <CommandShortcut>Ctrl+Z</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => store.temporal.getState().redo())}>
            {t('epk_editor_redo')}
            <CommandShortcut>Ctrl+Y</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => duplicateSelected())}>
            {t('epk_ctx_duplicate')}
            <CommandShortcut>Ctrl+D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => deleteSelected())}>
            {t('epk_ctx_delete')}
            <CommandShortcut>Del</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => groupSelected())}>
            {t('epk_editor_group')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t('epk_cmd_group_view')}>
          <CommandItem onSelect={() => run(() => setShowGrid(!showGrid))}>
            {showGrid ? t('epk_ctx_grid_off') : t('epk_ctx_grid_on')}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setSnapEnabled(!snapEnabled))}>
            {snapEnabled ? t('epk_ctx_snap_off') : t('epk_ctx_snap_on')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={t('epk_cmd_group_file')}>
          <CommandItem onSelect={() => run(onSave)}>
            {t('epk_editor_save')}
            <CommandShortcut>Ctrl+S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenVersionHistory)}>
            {t('epk_versions_title')}
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenShareLinks)}>
            {t('epk_share_title')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
'use client'

import { useTranslations } from 'next-intl'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'

interface EpkContextMenuProps {
  children: React.ReactNode
  onOpenAssetPicker: () => void
  onEditText?: (id: string) => void
}

export function EpkContextMenu({
  children,
  onOpenAssetPicker,
  onEditText,
}: EpkContextMenuProps) {
  const t = useTranslations('portal')
  const store = useEpkEditorStoreApi()
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const document = useEpkEditorStore((s) => s.document)
  const duplicateSelected = useEpkEditorStore((s) => s.duplicateSelected)
  const deleteSelected = useEpkEditorStore((s) => s.deleteSelected)
  const groupSelected = useEpkEditorStore((s) => s.groupSelected)
  const ungroupSelected = useEpkEditorStore((s) => s.ungroupSelected)
  const moveElementZ = useEpkEditorStore((s) => s.moveElementZ)
  const toggleElementLock = useEpkEditorStore((s) => s.toggleElementLock)
  const snapEnabled = useEpkEditorStore((s) => s.snapEnabled)
  const showGrid = useEpkEditorStore((s) => s.showGrid)
  const setSnapEnabled = useEpkEditorStore((s) => s.setSnapEnabled)
  const setShowGrid = useEpkEditorStore((s) => s.setShowGrid)
  const addElement = useEpkEditorStore((s) => s.addElement)

  const primaryId = selectedIds[0]
  const primary = primaryId
    ? document.elements.find((el) => el.id === primaryId)
    : undefined

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {primary ? (
          <>
            {primary.type === 'text' && onEditText ? (
              <ContextMenuItem onSelect={() => onEditText(primary.id)}>
                {t('epk_ctx_edit_text')}
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onSelect={() => duplicateSelected()}>
              {t('epk_ctx_duplicate')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => deleteSelected()}>
              {t('epk_ctx_delete')}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => moveElementZ(primary.id, 'front')}>
              {t('epk_ctx_bring_front')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => moveElementZ(primary.id, 'back')}>
              {t('epk_ctx_send_back')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => toggleElementLock(primary.id)}>
              {primary.locked ? t('epk_ctx_unlock') : t('epk_ctx_lock')}
            </ContextMenuItem>
            {selectedIds.length >= 2 ? (
              <ContextMenuItem onSelect={() => groupSelected()}>
                {t('epk_editor_group')}
              </ContextMenuItem>
            ) : null}
            {primary.type === 'group' ? (
              <ContextMenuItem onSelect={() => ungroupSelected()}>
                {t('epk_editor_ungroup')}
              </ContextMenuItem>
            ) : null}
            <ContextMenuSeparator />
          </>
        ) : (
          <>
            <ContextMenuItem onSelect={() => addElement('text')}>
              {t('epk_editor_add_text')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => addElement('shape')}>
              {t('epk_editor_add_shape')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={onOpenAssetPicker}>
              {t('epk_editor_add_image')}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => store.temporal.getState().undo()}>
          {t('epk_editor_undo')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => store.temporal.getState().redo()}>
          {t('epk_editor_redo')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setSnapEnabled(!snapEnabled)}>
          {snapEnabled ? t('epk_ctx_snap_off') : t('epk_ctx_snap_on')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setShowGrid(!showGrid)}>
          {showGrid ? t('epk_ctx_grid_off') : t('epk_ctx_grid_on')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
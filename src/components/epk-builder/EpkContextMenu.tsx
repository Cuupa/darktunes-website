'use client'

import { useTranslations } from 'next-intl'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'

export interface EpkContextMenuAnchor {
  x: number
  y: number
}

interface EpkContextMenuProps {
  children?: React.ReactNode
  anchor?: EpkContextMenuAnchor | null
  onClose?: () => void
  onOpenAssetPicker: () => void
  onReplaceImage?: () => void
  onEditText?: (id: string) => void
}

function useContextMenuActions(
  onOpenAssetPicker: () => void,
  onReplaceImage: (() => void) | undefined,
  onEditText?: (id: string) => void,
) {
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
  const primary = primaryId ? document.elements.find((el) => el.id === primaryId) : undefined

  const close = (action: () => void) => () => action()

  return {
    t,
    primary,
    selectedIds,
    close,
    items: {
      hasSelection: Boolean(primary),
      editText:
        primary?.type === 'text' && onEditText
          ? { label: t('epk_ctx_edit_text'), action: close(() => onEditText(primary.id)) }
          : null,
      replaceImage:
        (primary?.type === 'image' || primary?.type === 'logo') && onReplaceImage
          ? { label: t('epk_assets_replace'), action: close(onReplaceImage) }
          : null,
      duplicate: { label: t('epk_ctx_duplicate'), action: close(() => duplicateSelected()) },
      delete: { label: t('epk_ctx_delete'), action: close(() => deleteSelected()) },
      bringFront: primary
        ? { label: t('epk_ctx_bring_front'), action: close(() => moveElementZ(primary.id, 'front')) }
        : null,
      sendBack: primary
        ? { label: t('epk_ctx_send_back'), action: close(() => moveElementZ(primary.id, 'back')) }
        : null,
      lock: primary
        ? {
            label: primary.locked ? t('epk_ctx_unlock') : t('epk_ctx_lock'),
            action: close(() => toggleElementLock(primary.id)),
          }
        : null,
      group:
        selectedIds.length >= 2
          ? { label: t('epk_editor_group'), action: close(() => groupSelected()) }
          : null,
      ungroup:
        primary?.type === 'group'
          ? { label: t('epk_editor_ungroup'), action: close(() => ungroupSelected()) }
          : null,
      addText: { label: t('epk_editor_add_text'), action: close(() => addElement('text')) },
      addShape: { label: t('epk_editor_add_shape'), action: close(() => addElement('shape')) },
      addImage: { label: t('epk_editor_add_image'), action: close(onOpenAssetPicker) },
      undo: { label: t('epk_editor_undo'), action: close(() => store.temporal.getState().undo()) },
      redo: { label: t('epk_editor_redo'), action: close(() => store.temporal.getState().redo()) },
      snap: {
        label: snapEnabled ? t('epk_ctx_snap_off') : t('epk_ctx_snap_on'),
        action: close(() => setSnapEnabled(!snapEnabled)),
      },
      grid: {
        label: showGrid ? t('epk_ctx_grid_off') : t('epk_ctx_grid_on'),
        action: close(() => setShowGrid(!showGrid)),
      },
    },
  }
}

function EpkMenuItems({
  onOpenAssetPicker,
  onReplaceImage,
  onEditText,
  onClose,
  MenuItem,
  MenuSeparator,
}: EpkContextMenuProps & {
  MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem
  MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
}) {
  const { primary, selectedIds, items } = useContextMenuActions(
    onOpenAssetPicker,
    onReplaceImage,
    onEditText,
  )

  const wrap = (action: () => void) => () => {
    action()
    onClose?.()
  }

  return (
    <>
      {items.hasSelection && primary ? (
        <>
          {items.editText ? (
            <MenuItem onSelect={wrap(items.editText.action)}>{items.editText.label}</MenuItem>
          ) : null}
          {items.replaceImage ? (
            <MenuItem onSelect={wrap(items.replaceImage.action)}>{items.replaceImage.label}</MenuItem>
          ) : null}
          <MenuItem onSelect={wrap(items.duplicate.action)}>{items.duplicate.label}</MenuItem>
          <MenuItem onSelect={wrap(items.delete.action)}>{items.delete.label}</MenuItem>
          <MenuSeparator />
          {items.bringFront ? (
            <MenuItem onSelect={wrap(items.bringFront.action)}>{items.bringFront.label}</MenuItem>
          ) : null}
          {items.sendBack ? (
            <MenuItem onSelect={wrap(items.sendBack.action)}>{items.sendBack.label}</MenuItem>
          ) : null}
          {items.lock ? (
            <MenuItem onSelect={wrap(items.lock.action)}>{items.lock.label}</MenuItem>
          ) : null}
          {selectedIds.length >= 2 && items.group ? (
            <MenuItem onSelect={wrap(items.group.action)}>{items.group.label}</MenuItem>
          ) : null}
          {items.ungroup ? (
            <MenuItem onSelect={wrap(items.ungroup.action)}>{items.ungroup.label}</MenuItem>
          ) : null}
          <MenuSeparator />
        </>
      ) : (
        <>
          <MenuItem onSelect={wrap(items.addText.action)}>{items.addText.label}</MenuItem>
          <MenuItem onSelect={wrap(items.addShape.action)}>{items.addShape.label}</MenuItem>
          <MenuItem onSelect={wrap(items.addImage.action)}>{items.addImage.label}</MenuItem>
          <MenuSeparator />
        </>
      )}
      <MenuItem onSelect={wrap(items.undo.action)}>{items.undo.label}</MenuItem>
      <MenuItem onSelect={wrap(items.redo.action)}>{items.redo.label}</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={wrap(items.snap.action)}>{items.snap.label}</MenuItem>
      <MenuItem onSelect={wrap(items.grid.action)}>{items.grid.label}</MenuItem>
    </>
  )
}

/** Radix context menu for non-canvas areas. */
export function EpkContextMenu({
  children,
  onOpenAssetPicker,
  onReplaceImage,
  onEditText,
}: EpkContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EpkMenuItems
          onOpenAssetPicker={onOpenAssetPicker}
          onReplaceImage={onReplaceImage}
          onEditText={onEditText}
          MenuItem={ContextMenuItem}
          MenuSeparator={ContextMenuSeparator}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** Positioned dropdown for Konva canvas right-clicks. */
export function EpkCanvasContextMenu({
  anchor,
  onClose,
  onOpenAssetPicker,
  onReplaceImage,
  onEditText,
}: Omit<EpkContextMenuProps, 'children'> & { anchor: EpkContextMenuAnchor }) {
  return (
    <DropdownMenu open onOpenChange={(open) => { if (!open) onClose?.() }}>
      <DropdownMenuTrigger asChild>
        <span
          className="pointer-events-none fixed z-50 h-px w-px"
          style={{ left: anchor.x, top: anchor.y }}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" sideOffset={4}>
        <EpkMenuItems
          onOpenAssetPicker={onOpenAssetPicker}
          onReplaceImage={onReplaceImage}
          onEditText={onEditText}
          onClose={onClose}
          MenuItem={DropdownMenuItem}
          MenuSeparator={DropdownMenuSeparator}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
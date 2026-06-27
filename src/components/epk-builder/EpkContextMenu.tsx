'use client'

import { useTranslations } from 'next-intl'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'
import { EPK_GRADIENT_PRESETS } from '@/lib/epk/gradients'

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
  onCropImage?: () => void
}

function useContextMenuActions(
  onOpenAssetPicker: () => void,
  onReplaceImage: (() => void) | undefined,
  onEditText?: (id: string) => void,
  onCropImage?: () => void,
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
  const alignSelected = useEpkEditorStore((s) => s.alignSelected)
  const applyGradientToSelected = useEpkEditorStore((s) => s.applyGradientToSelected)
  const toggleSelectedFlip = useEpkEditorStore((s) => s.toggleSelectedFlip)

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
      cropImage:
        (primary?.type === 'image' || primary?.type === 'logo') && primary.src && onCropImage
          ? { label: t('epk_editor_crop_open'), action: close(onCropImage) }
          : null,
      flipH:
        primary?.type === 'image' || primary?.type === 'logo'
          ? { label: t('epk_flip_horizontal'), action: close(() => toggleSelectedFlip('x')) }
          : null,
      flipV:
        primary?.type === 'image' || primary?.type === 'logo'
          ? { label: t('epk_flip_vertical'), action: close(() => toggleSelectedFlip('y')) }
          : null,
      alignCenterH: primary
        ? { label: t('epk_align_center_h'), action: close(() => alignSelected('center-h')) }
        : null,
      alignCenterV: primary
        ? { label: t('epk_align_center_v'), action: close(() => alignSelected('center-v')) }
        : null,
      alignCenter: primary
        ? { label: t('epk_align_center'), action: close(() => alignSelected('center')) }
        : null,
      gradientPresets:
        primary?.type === 'shape'
          ? EPK_GRADIENT_PRESETS.map((preset) => ({
              label: preset.name,
              action: close(() => applyGradientToSelected(preset.gradient)),
            }))
          : [],
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
  onCropImage,
  onClose,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubTrigger,
  MenuSubContent,
}: EpkContextMenuProps & {
  MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem
  MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  MenuSub: typeof ContextMenuSub | typeof DropdownMenuSub
  MenuSubTrigger: typeof ContextMenuSubTrigger | typeof DropdownMenuSubTrigger
  MenuSubContent: typeof ContextMenuSubContent | typeof DropdownMenuSubContent
}) {
  const { t, primary, selectedIds, items } = useContextMenuActions(
    onOpenAssetPicker,
    onReplaceImage,
    onEditText,
    onCropImage,
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
          {items.cropImage ? (
            <MenuItem onSelect={wrap(items.cropImage.action)}>{items.cropImage.label}</MenuItem>
          ) : null}
          {items.flipH ? (
            <MenuItem onSelect={wrap(items.flipH.action)}>{items.flipH.label}</MenuItem>
          ) : null}
          {items.flipV ? (
            <MenuItem onSelect={wrap(items.flipV.action)}>{items.flipV.label}</MenuItem>
          ) : null}
          <MenuSeparator />
          {items.alignCenterH ? (
            <MenuItem onSelect={wrap(items.alignCenterH.action)}>{items.alignCenterH.label}</MenuItem>
          ) : null}
          {items.alignCenterV ? (
            <MenuItem onSelect={wrap(items.alignCenterV.action)}>{items.alignCenterV.label}</MenuItem>
          ) : null}
          {items.alignCenter ? (
            <MenuItem onSelect={wrap(items.alignCenter.action)}>{items.alignCenter.label}</MenuItem>
          ) : null}
          {items.gradientPresets.length > 0 ? (
            <MenuSub>
              <MenuSubTrigger>{t('epk_fill_gradient')}</MenuSubTrigger>
              <MenuSubContent>
                {items.gradientPresets.map((preset) => (
                  <MenuItem key={preset.label} onSelect={wrap(preset.action)}>
                    {preset.label}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
          ) : null}
          <MenuSeparator />
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
  onCropImage,
}: EpkContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EpkMenuItems
          onOpenAssetPicker={onOpenAssetPicker}
          onReplaceImage={onReplaceImage}
          onEditText={onEditText}
          onCropImage={onCropImage}
          MenuItem={ContextMenuItem}
          MenuSeparator={ContextMenuSeparator}
          MenuSub={ContextMenuSub}
          MenuSubTrigger={ContextMenuSubTrigger}
          MenuSubContent={ContextMenuSubContent}
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
  onCropImage,
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
          onCropImage={onCropImage}
          onClose={onClose}
          MenuItem={DropdownMenuItem}
          MenuSeparator={DropdownMenuSeparator}
          MenuSub={DropdownMenuSub}
          MenuSubTrigger={DropdownMenuSubTrigger}
          MenuSubContent={DropdownMenuSubContent}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
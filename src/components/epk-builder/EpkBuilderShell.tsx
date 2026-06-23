'use client'

/**
 * src/components/epk-builder/EpkBuilderShell.tsx
 *
 * Full editor layout: toolbar, canvas, pages, layers, properties, and Phase 3 panels.
 */

import { useEffect, useState } from 'react'
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'
import { EpkToolbar } from './EpkToolbar'
import { EpkCanvas } from './EpkCanvas'
import { EpkPagesPanel } from './EpkPagesPanel'
import { EpkLayersPanel } from './EpkLayersPanel'
import { EpkPropertiesPanel } from './EpkPropertiesPanel'
import { EpkAssetPicker } from './EpkAssetPicker'
import { EpkVersionHistoryPanel } from './EpkVersionHistoryPanel'
import { EpkShareLinkPanel } from './EpkShareLinkPanel'
import { EpkDownloadStatsPanel } from './EpkDownloadStatsPanel'
import { EpkTemplatePicker } from './EpkTemplatePicker'
import type { EpkTemplate } from '@/lib/api/epkTemplates'
import { EpkFontLoader } from './EpkFontLoader'
import { EpkFontManager, type EpkFontAsset } from './EpkFontManager'
import type { ArtistAsset } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface EpkBuilderShellProps {
  dict: Dictionary['portal']
  artistId: string
  initialAssets: ArtistAsset[]
  initialFonts: EpkFontAsset[]
  onSave: () => void
  onSaveSnapshot: () => void
  onVersionRestored: (documentVersion: number) => void
  isSaving: boolean
}

export function EpkBuilderShell({
  dict,
  artistId,
  initialAssets,
  initialFonts,
  onSave,
  onSaveSnapshot,
  onVersionRestored,
  isSaving,
}: EpkBuilderShellProps) {
  const store = useEpkEditorStoreApi()
  const setDocument = useEpkEditorStore((s) => s.setDocument)
  const applyDocument = useEpkEditorStore((s) => s.applyDocument)
  const addElement = useEpkEditorStore((s) => s.addElement)
  const deleteSelected = useEpkEditorStore((s) => s.deleteSelected)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)

  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [shareLinksOpen, setShareLinksOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const handleApplyTemplate = (template: EpkTemplate) => {
    const document = structuredClone(template.document)
    // Template custom fonts live in admin storage — artists use their own font library.
    document.fonts = []
    applyDocument(document)
    store.temporal.getState().clear()
  }

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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, selectedIds.length, store])

  return (
    <div className="space-y-4">
      <EpkFontLoader />
      <EpkToolbar
        dict={dict}
        onSave={onSave}
        onSaveSnapshot={onSaveSnapshot}
        onOpenAssetPicker={() => setAssetPickerOpen(true)}
        onOpenVersionHistory={() => setVersionHistoryOpen(true)}
        onOpenShareLinks={() => setShareLinksOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        isSaving={isSaving}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <EpkCanvas />
        <div className="space-y-4">
          <EpkPagesPanel dict={dict} />
          <EpkLayersPanel dict={dict} />
          <EpkFontManager dict={dict} artistId={artistId} initialFonts={initialFonts} />
          <EpkPropertiesPanel dict={dict} />
        </div>
      </div>

      <EpkAssetPicker
        dict={dict}
        artistId={artistId}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        initialAssets={initialAssets}
        onSelect={(url) => addElement('image', { src: url })}
      />

      <EpkVersionHistoryPanel
        dict={dict}
        artistId={artistId}
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        onRestored={onVersionRestored}
        onDocumentRestore={setDocument}
      />

      <EpkShareLinkPanel
        dict={dict}
        artistId={artistId}
        open={shareLinksOpen}
        onClose={() => setShareLinksOpen(false)}
      />

      <EpkDownloadStatsPanel
        dict={dict}
        artistId={artistId}
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />

      <EpkTemplatePicker
        dict={dict}
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onApply={handleApplyTemplate}
      />
    </div>
  )
}
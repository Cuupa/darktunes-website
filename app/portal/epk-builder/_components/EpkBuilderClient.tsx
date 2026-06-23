'use client'

/**
 * app/portal/epk-builder/_components/EpkBuilderClient.tsx
 *
 * Phase 2 EPK Builder — interactive Konva editor + autosave + server PDF export.
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { FilePdf, ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { EpkEditorProvider, useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useEpkAutosave } from '@/hooks/useEpkAutosave'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { hydrateDocumentFonts } from '@/lib/epk/editor/hydrateDocumentFonts'
import type { EpkFontAsset } from '@/components/epk-builder/EpkFontManager'
import type { ArtistAsset } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { toast } from 'sonner'

const EpkBuilderShell = dynamic(
  () => import('@/components/epk-builder/EpkBuilderShell').then((m) => m.EpkBuilderShell),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] animate-pulse rounded-lg border border-border bg-muted/40" />
    ),
  },
)

interface EpkBuilderClientProps {
  dict: Dictionary['portal']
  artistId: string
  artistName: string
  initialDocument: EpkDocumentV2
  documentVersion: number
  initialAssets: ArtistAsset[]
  initialFonts: EpkFontAsset[]
}

function EpkBuilderWorkspace({
  dict,
  artistId,
  artistName,
  documentVersion: initialVersion,
  initialAssets,
  initialFonts,
}: Omit<EpkBuilderClientProps, 'initialDocument'>) {
  const document = useEpkEditorStore((s) => s.document)
  const isDirty = useEpkEditorStore((s) => s.isDirty)
  const markClean = useEpkEditorStore((s) => s.markClean)
  const [documentVersion, setDocumentVersion] = useState(initialVersion)
  const [exporting, setExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { saveNow } = useEpkAutosave({
    artistId,
    document,
    isDirty,
    onMarkClean: markClean,
    onSaved: setDocumentVersion,
    saveErrorMessage: dict.epk_editor_save_error,
  })

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveNow()
      toast.success(dict.epk_editor_save_success)
    } finally {
      setIsSaving(false)
    }
  }, [dict.epk_editor_save_success, saveNow])

  const handleSaveSnapshot = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveNow({ createVersion: true, versionLabel: dict.epk_versions_snapshot_default })
      toast.success(dict.epk_versions_snapshot_success)
    } finally {
      setIsSaving(false)
    }
  }, [dict.epk_versions_snapshot_default, dict.epk_versions_snapshot_success, saveNow])

  const handleServerPdfExport = useCallback(async () => {
    setExporting(true)
    try {
      if (isDirty) await saveNow()

      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(dict.epk_builder_export_auth_error)
        return
      }

      const response = await fetch('/api/portal/epk/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          document,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? dict.epk_builder_export_error)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `${artistName.replace(/\s+/g, '-').toLowerCase()}-epk.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(dict.epk_builder_export_success)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.epk_builder_export_error)
    } finally {
      setExporting(false)
    }
  }, [artistId, artistName, dict, document, isDirty, saveNow])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href={`/portal/profile?artistId=${artistId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {dict.epk_builder_back_profile}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{dict.epk_builder_title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{dict.epk_editor_description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {dict.epk_builder_version_label.replace('{version}', String(documentVersion))}
            {isDirty ? ` · ${dict.epk_editor_unsaved}` : ''}
          </p>
        </div>
        <Button
          onClick={() => void handleServerPdfExport()}
          disabled={exporting}
          className="min-h-[44px] shrink-0"
        >
          <FilePdf className="mr-2 h-4 w-4" aria-hidden="true" />
          {exporting ? dict.epk_builder_exporting : dict.epk_builder_download_pdf}
        </Button>
      </div>

      <EpkBuilderShell
        dict={dict}
        artistId={artistId}
        initialAssets={initialAssets}
        initialFonts={initialFonts}
        onSave={() => void handleSave()}
        onSaveSnapshot={() => void handleSaveSnapshot()}
        onVersionRestored={setDocumentVersion}
        isSaving={isSaving}
      />
    </div>
  )
}

export function EpkBuilderClient({
  dict,
  artistId,
  artistName,
  initialDocument,
  documentVersion,
  initialAssets,
  initialFonts,
}: EpkBuilderClientProps) {
  const hydratedDocument = hydrateDocumentFonts(initialDocument, initialFonts)

  return (
    <EpkEditorProvider initialDocument={hydratedDocument}>
      <EpkBuilderWorkspace
        dict={dict}
        artistId={artistId}
        artistName={artistName}
        documentVersion={documentVersion}
        initialAssets={initialAssets}
        initialFonts={initialFonts}
      />
    </EpkEditorProvider>
  )
}
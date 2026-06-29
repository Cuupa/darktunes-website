'use client'

import '@/lib/epk/konvaShapes'
import { useTranslations } from 'next-intl'
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
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist, ArtistAsset } from '@/types'
import type { EpkPickerAsset } from '@/lib/epk/pickerAssets'
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
  artistId: string
  artistName: string
  artist: Artist
  artistProfile: ArtistProfile | null
  initialDocument: EpkDocumentV2
  documentVersion: number
  initialAssets: ArtistAsset[]
  pickerAssets: EpkPickerAsset[]
  initialFonts: EpkFontAsset[]
}

function EpkBuilderWorkspace({
  artistId,
  artistName,
  artist,
  artistProfile,
  documentVersion: initialVersion,
  initialAssets,
  pickerAssets,
  initialFonts,
}: Omit<EpkBuilderClientProps, 'initialDocument'>) {
  const t = useTranslations('portal')

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
    saveErrorMessage: t('epk_editor_save_error'),
  })

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveNow()
      toast.success(t('epk_editor_save_success'))
    } finally {
      setIsSaving(false)
    }
  }, [t, saveNow])

  const handleSaveSnapshot = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveNow({ createVersion: true, versionLabel: t('epk_versions_snapshot_default') })
      toast.success(t('epk_versions_snapshot_success'))
    } finally {
      setIsSaving(false)
    }
  }, [t, saveNow])

  const handleServerPdfExport = useCallback(async () => {
    setExporting(true)
    try {
      if (isDirty) await saveNow()

      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
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
        throw new Error(payload?.error ?? t('epk_builder_export_error'))
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `${artistName.replace(/\s+/g, '-').toLowerCase()}-epk.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(t('epk_builder_export_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('epk_builder_export_error'))
    } finally {
      setExporting(false)
    }
  }, [artistId, artistName, document, isDirty, saveNow, t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2">
            <Link href={`/portal/profile?artistId=${artistId}`}>
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('epk_builder_back_profile')}
            </Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{t('epk_builder_title')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('epk_builder_version_label').replace('{version}', String(documentVersion))}
            {isDirty ? ` · ${t('epk_editor_unsaved')}` : ''}
          </p>
        </div>
        <Button
          onClick={() => void handleServerPdfExport()}
          disabled={exporting}
          className="min-h-[44px] shrink-0"
        >
          <FilePdf className="mr-2 h-4 w-4" aria-hidden="true" />
          {exporting ? t('epk_builder_exporting') : t('epk_builder_download_pdf')}
        </Button>
      </div>

      <EpkBuilderShell
        artistId={artistId}
        artist={artist}
        artistProfile={artistProfile}
        initialAssets={initialAssets}
        pickerAssets={pickerAssets}
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
  artistId,
  artistName,
  artist,
  artistProfile,
  initialDocument,
  documentVersion,
  initialAssets,
  pickerAssets,
  initialFonts,
}: EpkBuilderClientProps) {
  const hydratedDocument = hydrateDocumentFonts(initialDocument, initialFonts)

  return (
    <EpkEditorProvider initialDocument={hydratedDocument}>
      <EpkBuilderWorkspace
        artistId={artistId}
        artistName={artistName}
        artist={artist}
        artistProfile={artistProfile}
        documentVersion={documentVersion}
        initialAssets={initialAssets}
        pickerAssets={pickerAssets}
        initialFonts={initialFonts}
      />
    </EpkEditorProvider>
  )
}
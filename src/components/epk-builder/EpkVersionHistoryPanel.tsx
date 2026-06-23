'use client'

/**
 * src/components/epk-builder/EpkVersionHistoryPanel.tsx
 *
 * Version snapshot list with restore support.
 */

import { useCallback, useEffect, useState } from 'react'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import type { Dictionary } from '@/i18n/types'
import { toast } from 'sonner'

interface EpkVersionSummary {
  id: string
  versionNumber: number
  label: string | undefined
  createdAt: string
}

interface EpkVersionHistoryPanelProps {
  dict: Dictionary['portal']
  artistId: string
  open: boolean
  onClose: () => void
  onRestored: (documentVersion: number) => void
  onDocumentRestore: (document: EpkDocumentV2) => void
}

export function EpkVersionHistoryPanel({
  dict,
  artistId,
  open,
  onClose,
  onRestored,
  onDocumentRestore,
}: EpkVersionHistoryPanelProps) {
  const [versions, setVersions] = useState<EpkVersionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmVersionId, setConfirmVersionId] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(
        `/api/portal/epk/versions?artistId=${artistId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      )
      if (!response.ok) throw new Error(dict.epk_versions_load_error)

      const payload = (await response.json()) as { versions: EpkVersionSummary[] }
      setVersions(payload.versions)
    } catch {
      toast.error(dict.epk_versions_load_error)
    } finally {
      setLoading(false)
    }
  }, [artistId, dict.epk_versions_load_error])

  useEffect(() => {
    if (open) void loadVersions()
  }, [open, loadVersions])

  const handleRestore = useCallback(async (versionId: string) => {
    setRestoringId(versionId)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(dict.epk_builder_export_auth_error)
        return
      }

      const response = await fetch(`/api/portal/epk/versions/${versionId}/restore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artist_id: artistId }),
      })

      if (!response.ok) throw new Error(dict.epk_versions_restore_error)

      const payload = (await response.json()) as {
        document: EpkDocumentV2
        documentVersion: number
      }

      onDocumentRestore(payload.document)
      onRestored(payload.documentVersion)
      onClose()
      toast.success(dict.epk_versions_restore_success)
      void loadVersions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.epk_versions_restore_error)
    } finally {
      setRestoringId(null)
    }
  }, [
    artistId,
    dict,
    loadVersions,
    onClose,
    onDocumentRestore,
    onRestored,
  ])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl p-0"
        aria-labelledby="epk-version-history-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-version-history-title" className="flex items-center gap-2">
            <ClockCounterClockwise size={20} aria-hidden="true" />
            {dict.epk_versions_title}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] p-6" data-lenis-prevent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{dict.epk_versions_loading}</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.epk_versions_empty}</p>
          ) : (
            <ul className="space-y-3 list-none">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {dict.epk_versions_item.replace('{version}', String(version.versionNumber))}
                    </p>
                    {version.label && (
                      <p className="text-xs text-muted-foreground mt-0.5">{version.label}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] shrink-0"
                    disabled={restoringId === version.id}
                    onClick={() => setConfirmVersionId(version.id)}
                  >
                    {restoringId === version.id
                      ? dict.epk_versions_restoring
                      : dict.epk_versions_restore}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>

      <AlertDialog
        open={confirmVersionId !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setConfirmVersionId(null) }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.epk_versions_restore}</AlertDialogTitle>
            <AlertDialogDescription>{dict.epk_versions_restore_confirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">{dict.epk_versions_cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              onClick={() => {
                if (confirmVersionId) void handleRestore(confirmVersionId)
                setConfirmVersionId(null)
              }}
            >
              {dict.epk_versions_restore}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
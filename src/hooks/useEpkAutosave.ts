/**
 * src/hooks/useEpkAutosave.ts
 *
 * Debounced autosave for the EPK canvas editor document.
 */

import { useCallback, useEffect, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

export interface EpkSaveOptions {
  createVersion?: boolean
  versionLabel?: string
  expectedVersion?: number
}

interface UseEpkAutosaveOptions {
  artistId: string
  document: EpkDocumentV2
  isDirty: boolean
  onSaved: (version: number) => void
  onMarkClean: () => void
  debounceMs?: number
  saveErrorMessage: string
}

export function useEpkAutosave({
  artistId,
  document,
  isDirty,
  onSaved,
  onMarkClean,
  debounceMs = 3000,
  saveErrorMessage,
}: UseEpkAutosaveOptions): {
  isSaving: boolean
  saveNow: (options?: EpkSaveOptions) => Promise<boolean>
} {
  const isSavingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentRef = useRef(document)
  documentRef.current = document

  const persist = useCallback(async (options?: EpkSaveOptions) => {
    if (isSavingRef.current) return false
    isSavingRef.current = true
    const sentDocument = documentRef.current
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return false

      const response = await fetch('/api/portal/epk/document', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          document: sentDocument,
          create_version: options?.createVersion ?? false,
          version_label: options?.versionLabel,
          expected_version: options?.expectedVersion,
        }),
      })

      if (!response.ok) {
        let message = saveErrorMessage
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload?.error) message = payload.error
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      // Don't mark clean if the document changed while the save was in flight.
      if (documentRef.current !== sentDocument) {
        return false
      }

      const payload = (await response.json()) as { documentVersion: number }
      onMarkClean()
      onSaved(payload.documentVersion)
      return true
    } catch {
      toast.error(saveErrorMessage)
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [artistId, onMarkClean, onSaved, saveErrorMessage])

  useEffect(() => {
    if (!isDirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persist()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [document, isDirty, debounceMs, persist])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      void persist()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, persist])

  return {
    isSaving: isSavingRef.current,
    saveNow: persist,
  }
}
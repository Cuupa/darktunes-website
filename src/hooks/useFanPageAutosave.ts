/**
 * Debounced autosave for the Fan Page editor document.
 */

import { useCallback, useEffect, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

interface UseFanPageAutosaveOptions {
  artistId: string
  document: LandingPageDocumentV1
  isDirty: boolean
  onSaved: (version: number) => void
  onMarkClean: () => void
  debounceMs?: number
  saveErrorMessage: string
}

export function useFanPageAutosave({
  artistId,
  document,
  isDirty,
  onSaved,
  onMarkClean,
  debounceMs = 3000,
  saveErrorMessage,
}: UseFanPageAutosaveOptions): {
  saveNow: () => Promise<void>
} {
  const isSavingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentRef = useRef(document)
  documentRef.current = document

  const persist = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/portal/fan-page/document?artistId=${artistId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          document: documentRef.current,
        }),
      })

      if (!response.ok) throw new Error(saveErrorMessage)

      const payload = (await response.json()) as { documentVersion: number }
      onMarkClean()
      onSaved(payload.documentVersion)
    } catch {
      toast.error(saveErrorMessage)
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

  return { saveNow: persist }
}
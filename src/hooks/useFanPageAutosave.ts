/**
 * Debounced autosave for the Fan Page editor document.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'

export type FanPageSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

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
  debounceMs = 1500,
  saveErrorMessage,
}: UseFanPageAutosaveOptions): {
  saveStatus: FanPageSaveStatus
  saveNow: () => Promise<void>
} {
  const [saveStatus, setSaveStatus] = useState<FanPageSaveStatus>('idle')
  const isSavingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentRef = useRef(document)
  documentRef.current = document

  const persist = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setSaveStatus('saving')
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSaveStatus('idle')
        return
      }

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
      setSaveStatus('saved')
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current)
      savedFadeRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      toast.error(saveErrorMessage)
    } finally {
      isSavingRef.current = false
    }
  }, [artistId, onMarkClean, onSaved, saveErrorMessage])

  useEffect(() => {
    if (!isDirty) return
    setSaveStatus((prev) => (prev === 'saving' ? 'saving' : 'pending'))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persist()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [document, isDirty, debounceMs, persist])

  useEffect(
    () => () => {
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current)
    },
    [],
  )

  return { saveStatus, saveNow: persist }
}
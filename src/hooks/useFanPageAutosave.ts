/**
 * Debounced autosave for the Fan Page editor document.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [isSaving, setIsSaving] = useState(false)
  const [outcome, setOutcome] = useState<'idle' | 'saved' | 'error'>('idle')
  const isSavingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const documentRef = useRef(document)
  documentRef.current = document

  const saveStatus: FanPageSaveStatus = useMemo(() => {
    if (isSaving) return 'saving'
    if (outcome === 'saved') return 'saved'
    if (outcome === 'error') return 'error'
    if (isDirty) return 'pending'
    return 'idle'
  }, [isDirty, isSaving, outcome])

  const persist = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    setIsSaving(true)
    setOutcome('idle')
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
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
      setOutcome('saved')
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current)
      savedFadeRef.current = setTimeout(() => setOutcome('idle'), 2500)
    } catch {
      setOutcome('error')
      toast.error(saveErrorMessage)
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [artistId, onMarkClean, onSaved, saveErrorMessage])

  useEffect(() => {
    if (!isDirty || isSaving) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persist()
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [document, isDirty, isSaving, debounceMs, persist])

  useEffect(
    () => () => {
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current)
    },
    [],
  )

  return { saveStatus, saveNow: persist }
}
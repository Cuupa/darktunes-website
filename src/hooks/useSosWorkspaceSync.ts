'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AccountingWorkspaceConfig } from '@/lib/api/sosAccountingWorkspaces'
import {
  settingsFingerprint,
  type SosAccountingSettings,
} from '@/lib/sos/sosAccountingSettings'

const AUTO_SAVE_DEBOUNCE_MS = 2_000

export interface PeriodKey {
  start: string
  end: string
}

interface WorkspaceApiResponse {
  workspace?: {
    config?: AccountingWorkspaceConfig
    updated_at?: string
    updated_by?: string | null
  }
}

interface DefaultPresetApiResponse {
  preset?: {
    config?: AccountingWorkspaceConfig
    updated_at?: string
  }
}

export interface UseSosWorkspaceSyncOptions {
  currentPeriodKey: PeriodKey | null
  settings: SosAccountingSettings
  applySettings: (settings: SosAccountingSettings) => void
  bronzeBatchIds: string[]
  settingsReady: boolean
  disabled?: boolean
}

export function useSosWorkspaceSync({
  currentPeriodKey,
  settings,
  applySettings,
  bronzeBatchIds,
  settingsReady,
  disabled = false,
}: UseSosWorkspaceSyncOptions) {
  const [workspaceLoadedAt, setWorkspaceLoadedAt] = useState<string | null>(null)
  const [workspaceUpdatedBy, setWorkspaceUpdatedBy] = useState<string | null>(null)
  const [defaultPresetLoadedAt, setDefaultPresetLoadedAt] = useState<string | null>(null)
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false)
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false)
  const [isSettingsDirty, setIsSettingsDirty] = useState(false)
  const [isPeriodWorkspaceReady, setIsPeriodWorkspaceReady] = useState(false)
  const [isDefaultPresetReady, setIsDefaultPresetReady] = useState(false)

  const lastSavedFingerprintRef = useRef<string | null>(null)
  const suppressAutoSaveRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markSynced = useCallback(
    (
      nextSettings: SosAccountingSettings,
      updatedAt: string | null,
      updatedBy: string | null,
    ) => {
      const fingerprint = settingsFingerprint(nextSettings)
      lastSavedFingerprintRef.current = fingerprint
      setIsSettingsDirty(false)
      setWorkspaceLoadedAt(updatedAt)
      setWorkspaceUpdatedBy(updatedBy)
    },
    [],
  )

  const markDefaultSynced = useCallback((nextSettings: SosAccountingSettings, updatedAt: string | null) => {
    const fingerprint = settingsFingerprint(nextSettings)
    lastSavedFingerprintRef.current = fingerprint
    setIsSettingsDirty(false)
    setDefaultPresetLoadedAt(updatedAt)
    setWorkspaceLoadedAt(null)
    setWorkspaceUpdatedBy(null)
  }, [])

  const saveWorkspace = useCallback(
    async (nextSettings: SosAccountingSettings, periodKey: PeriodKey): Promise<boolean> => {
      setIsWorkspaceSaving(true)
      try {
        const res = await fetch('/api/admin/sos/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period_start: periodKey.start,
            period_end: periodKey.end,
            config: nextSettings,
            bronze_batch_ids: bronzeBatchIds,
          }),
        })

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err?.error || 'Failed to save workspace')
        }

        const json = (await res.json()) as WorkspaceApiResponse
        const ws = json.workspace
        markSynced(
          nextSettings,
          ws?.updated_at ?? new Date().toISOString(),
          ws?.updated_by ?? null,
        )
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Save failed'
        toast.error(msg)
        return false
      } finally {
        setIsWorkspaceSaving(false)
      }
    },
    [bronzeBatchIds, markSynced],
  )

  const saveDefaultPreset = useCallback(
    async (nextSettings: SosAccountingSettings): Promise<boolean> => {
      setIsWorkspaceSaving(true)
      try {
        const res = await fetch('/api/admin/sos/presets/default', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: nextSettings }),
        })

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(err?.error || 'Failed to save default preset')
        }

        const json = (await res.json()) as DefaultPresetApiResponse
        markDefaultSynced(
          nextSettings,
          json.preset?.updated_at ?? new Date().toISOString(),
        )
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Save failed'
        toast.error(msg)
        return false
      } finally {
        setIsWorkspaceSaving(false)
      }
    },
    [markDefaultSynced],
  )

  const loadWorkspace = useCallback(
    async (options?: { force?: boolean }): Promise<void> => {
      if (!currentPeriodKey) return

      if (isSettingsDirty && !options?.force) {
        const confirmed = window.confirm(
          'Reload from server? Unsaved changes in this browser will be replaced by the server workspace.',
        )
        if (!confirmed) return
      }

      setIsWorkspaceLoading(true)
      try {
        const params = new URLSearchParams({
          periodStart: currentPeriodKey.start,
          periodEnd: currentPeriodKey.end,
        })
        const res = await fetch(`/api/admin/sos/workspaces?${params}`)
        if (!res.ok) {
          setWorkspaceLoadedAt(null)
          setWorkspaceUpdatedBy(null)
          return
        }

        const json = (await res.json()) as WorkspaceApiResponse
        const ws = json.workspace
        if (ws?.config) {
          suppressAutoSaveRef.current = true
          applySettings(ws.config)
          markSynced(
            ws.config,
            ws.updated_at ?? new Date().toISOString(),
            ws.updated_by ?? null,
          )
        } else {
          setWorkspaceLoadedAt(null)
          setWorkspaceUpdatedBy(null)
        }
      } catch (e) {
        console.warn('[useSosWorkspaceSync] load failed', e)
      } finally {
        setIsWorkspaceLoading(false)
        window.setTimeout(() => {
          suppressAutoSaveRef.current = false
        }, 0)
      }
    },
    [applySettings, currentPeriodKey, isSettingsDirty, markSynced],
  )

  const saveCurrentWorkspace = useCallback(async (): Promise<boolean> => {
    if (!currentPeriodKey) {
      const ok = await saveDefaultPreset(settings)
      if (ok) toast.success('Default accounting settings saved to server')
      return ok
    }
    const ok = await saveWorkspace(settings, currentPeriodKey)
    if (ok) toast.success('Accounting workspace saved to server')
    return ok
  }, [currentPeriodKey, settings, saveDefaultPreset, saveWorkspace])

  const loadDefaultPreset = useCallback(async (): Promise<void> => {
    setIsWorkspaceLoading(true)
    try {
      const res = await fetch('/api/admin/sos/presets/default')
      if (!res.ok) return

      const json = (await res.json()) as DefaultPresetApiResponse
      const preset = json.preset
      if (preset?.config) {
        suppressAutoSaveRef.current = true
        applySettings(preset.config)
        markDefaultSynced(
          preset.config,
          preset.updated_at ?? new Date().toISOString(),
        )
      }
    } catch (e) {
      console.warn('[useSosWorkspaceSync] default preset load failed', e)
    } finally {
      setIsWorkspaceLoading(false)
      setIsDefaultPresetReady(true)
      window.setTimeout(() => {
        suppressAutoSaveRef.current = false
      }, 0)
    }
  }, [applySettings, markDefaultSynced])

  // Load server workspace when period changes (server is SSOT for period-keyed settings).
  useEffect(() => {
    if (!currentPeriodKey) {
      setIsPeriodWorkspaceReady(false)
      return
    }

    setIsPeriodWorkspaceReady(false)
    let cancelled = false
    void (async () => {
      setIsWorkspaceLoading(true)
      try {
        const params = new URLSearchParams({
          periodStart: currentPeriodKey.start,
          periodEnd: currentPeriodKey.end,
        })
        const res = await fetch(`/api/admin/sos/workspaces?${params}`)
        if (!res.ok || cancelled) {
          if (!cancelled) {
            setWorkspaceLoadedAt(null)
            setWorkspaceUpdatedBy(null)
          }
          return
        }

        const json = (await res.json()) as WorkspaceApiResponse
        if (cancelled) return

        const ws = json.workspace
        if (ws?.config) {
          suppressAutoSaveRef.current = true
          applySettings(ws.config)
          markSynced(
            ws.config,
            ws.updated_at ?? new Date().toISOString(),
            ws.updated_by ?? null,
          )
        } else {
          setWorkspaceLoadedAt(null)
          setWorkspaceUpdatedBy(null)
        }
      } catch (e) {
        if (!cancelled) console.warn('[useSosWorkspaceSync] period load failed', e)
      } finally {
        if (!cancelled) {
          setIsWorkspaceLoading(false)
          setIsPeriodWorkspaceReady(true)
        }
        window.setTimeout(() => {
          suppressAutoSaveRef.current = false
        }, 0)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentPeriodKey, applySettings, markSynced])

  // Track dirty state and debounced auto-save.
  useEffect(() => {
    if (!settingsReady || disabled) return

    const fingerprint = settingsFingerprint(settings)
    const saved = lastSavedFingerprintRef.current

    if (!currentPeriodKey) {
      if (!isDefaultPresetReady || suppressAutoSaveRef.current) return

      if (saved !== null && fingerprint === saved) {
        setIsSettingsDirty(false)
        return
      }

      setIsSettingsDirty(true)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => {
        void saveDefaultPreset(settings)
      }, AUTO_SAVE_DEBOUNCE_MS)
      return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      }
    }

    if (!isPeriodWorkspaceReady || suppressAutoSaveRef.current) return

    if (saved !== null && fingerprint === saved) {
      setIsSettingsDirty(false)
      return
    }

    setIsSettingsDirty(true)

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      void saveWorkspace(settings, currentPeriodKey)
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [
    settings,
    settingsReady,
    currentPeriodKey,
    isPeriodWorkspaceReady,
    isDefaultPresetReady,
    disabled,
    saveDefaultPreset,
    saveWorkspace,
  ])

  return {
    workspaceLoadedAt,
    workspaceUpdatedBy,
    defaultPresetLoadedAt,
    isWorkspaceLoading,
    isWorkspaceSaving,
    isSettingsDirty,
    loadWorkspace,
    loadDefaultPreset,
    saveCurrentWorkspace,
  }
}
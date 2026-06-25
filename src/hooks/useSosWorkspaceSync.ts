'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AccountingWorkspaceConfig } from '@/lib/api/sosAccountingWorkspaces'
import type { SosRulesBundle } from '@/lib/sos/sosRulesBundle'

const RULES_CACHE_KEY = 'sos-rules-state'
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

export interface UseSosWorkspaceSyncOptions {
  currentPeriodKey: PeriodKey | null
  rulesBundle: SosRulesBundle
  applyRulesBundle: (bundle: SosRulesBundle) => void
  cacheRulesBundle: (bundle: SosRulesBundle) => void
  bronzeBatchIds: string[]
  rulesReady: boolean
  disabled?: boolean
}

function bundleFingerprint(bundle: SosRulesBundle): string {
  return JSON.stringify(bundle)
}

function configToBundle(config: AccountingWorkspaceConfig): SosRulesBundle {
  return {
    artistMappings: config.artistMappings ?? [],
    compilationFilters: config.compilationFilters ?? [],
    splitFees: config.splitFees ?? [],
    manualRevenues: config.manualRevenues ?? [],
    expenses: config.expenses ?? [],
    ignoredEntries: config.ignoredEntries ?? [],
    csvAliases: config.csvAliases ?? [],
    trackRevenueAssignments: config.trackRevenueAssignments ?? [],
    appDefaults: config.appDefaults,
    emailConfig: config.emailConfig ?? {},
  }
}

export function useSosWorkspaceSync({
  currentPeriodKey,
  rulesBundle,
  applyRulesBundle,
  cacheRulesBundle,
  bronzeBatchIds,
  rulesReady,
  disabled = false,
}: UseSosWorkspaceSyncOptions) {
  const [workspaceLoadedAt, setWorkspaceLoadedAt] = useState<string | null>(null)
  const [workspaceUpdatedBy, setWorkspaceUpdatedBy] = useState<string | null>(null)
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false)
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false)
  const [isRulesDirty, setIsRulesDirty] = useState(false)
  const [isPeriodWorkspaceReady, setIsPeriodWorkspaceReady] = useState(false)

  const lastSavedFingerprintRef = useRef<string | null>(null)
  const suppressAutoSaveRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markSynced = useCallback(
    (bundle: SosRulesBundle, updatedAt: string | null, updatedBy: string | null) => {
      const fingerprint = bundleFingerprint(bundle)
      lastSavedFingerprintRef.current = fingerprint
      setIsRulesDirty(false)
      setWorkspaceLoadedAt(updatedAt)
      setWorkspaceUpdatedBy(updatedBy)
      cacheRulesBundle(bundle)
    },
    [cacheRulesBundle],
  )

  const saveWorkspace = useCallback(
    async (bundle: SosRulesBundle, periodKey: PeriodKey): Promise<boolean> => {
      setIsWorkspaceSaving(true)
      try {
        const config: AccountingWorkspaceConfig = {
          artistMappings: bundle.artistMappings,
          compilationFilters: bundle.compilationFilters,
          splitFees: bundle.splitFees,
          manualRevenues: bundle.manualRevenues,
          expenses: bundle.expenses,
          ignoredEntries: bundle.ignoredEntries,
          csvAliases: bundle.csvAliases,
          trackRevenueAssignments: bundle.trackRevenueAssignments,
          appDefaults: bundle.appDefaults,
          emailConfig: bundle.emailConfig,
        }

        const res = await fetch('/api/admin/sos/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period_start: periodKey.start,
            period_end: periodKey.end,
            config,
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
          bundle,
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

  const loadWorkspace = useCallback(
    async (options?: { force?: boolean }): Promise<void> => {
      if (!currentPeriodKey) return

      if (isRulesDirty && !options?.force) {
        const confirmed = window.confirm(
          'Reload from server? Unsaved rule changes in this browser will be replaced by the server workspace.',
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
          const bundle = configToBundle(ws.config)
          applyRulesBundle(bundle)
          markSynced(
            bundle,
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
    [applyRulesBundle, currentPeriodKey, isRulesDirty, markSynced],
  )

  const saveCurrentWorkspace = useCallback(async (): Promise<boolean> => {
    if (!currentPeriodKey) {
      toast.error('No period detected yet — upload CSVs first')
      return false
    }
    const ok = await saveWorkspace(rulesBundle, currentPeriodKey)
    if (ok) {
      toast.success('Accounting workspace saved to server')
    }
    return ok
  }, [currentPeriodKey, rulesBundle, saveWorkspace])

  // Load server workspace when period changes (server is SSOT for period-keyed rules).
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
          const bundle = configToBundle(ws.config)
          applyRulesBundle(bundle)
          markSynced(
            bundle,
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
  }, [currentPeriodKey, applyRulesBundle, markSynced])

  // Track dirty state and debounced auto-save to server when a period is active.
  useEffect(() => {
    if (!rulesReady || disabled) return

    const fingerprint = bundleFingerprint(rulesBundle)
    const saved = lastSavedFingerprintRef.current

    if (!currentPeriodKey) {
      if (saved === null) {
        cacheRulesBundle(rulesBundle)
      }
      return
    }

    if (!isPeriodWorkspaceReady || suppressAutoSaveRef.current) return

    if (saved !== null && fingerprint === saved) {
      setIsRulesDirty(false)
      return
    }

    setIsRulesDirty(true)

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      void saveWorkspace(rulesBundle, currentPeriodKey)
    }, AUTO_SAVE_DEBOUNCE_MS)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [
    rulesBundle,
    rulesReady,
    currentPeriodKey,
    isPeriodWorkspaceReady,
    disabled,
    cacheRulesBundle,
    saveWorkspace,
  ])

  return {
    workspaceLoadedAt,
    workspaceUpdatedBy,
    isWorkspaceLoading,
    isWorkspaceSaving,
    isRulesDirty,
    loadWorkspace,
    saveCurrentWorkspace,
    rulesCacheKey: RULES_CACHE_KEY,
  }
}
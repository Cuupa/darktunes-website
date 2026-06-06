'use client'

/**
 * src/hooks/useSosRulesPresets.ts
 *
 * CRUD hook for SOS rule presets stored in Supabase (sos_rules_presets table).
 * Auto-loads presets on mount. Provides save, load (apply to state), and delete.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type {
  ArtistMapping, CompilationFilter, SplitFee,
  ManualRevenue, ExpenseEntry, IgnoredEntry,
  CSVColumnAlias, AppDefaults, EmailConfig,
  TrackRevenueAssignment,
} from '@/lib/sos/types'

export interface SosRulesPreset {
  id: string
  name: string
  config: PresetConfig
  created_at: string
  updated_at: string
}

export interface PresetConfig {
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>
  trackRevenueAssignments: TrackRevenueAssignment[]
}

export function useSosRulesPresets() {
  const [presets, setPresets] = useState<SosRulesPreset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const loadPresets = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/sos/presets')
      if (!res.ok) return
      const data = await res.json() as { presets: SosRulesPreset[] }
      setPresets(data.presets ?? [])
    } catch {
      // Non-fatal — presets may not exist yet
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  const savePreset = useCallback(async (name: string, config: PresetConfig): Promise<void> => {
    setIsSaving(true)
    try {
      const existing = presets.find(p => p.name.toLowerCase() === name.toLowerCase())
      if (existing) {
        const res = await fetch(`/api/admin/sos/presets/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, config }),
        })
        if (!res.ok) throw new Error('Failed to update preset')
        const data = await res.json() as { preset: SosRulesPreset }
        setPresets(prev => prev.map(p => p.id === existing.id ? data.preset : p))
      } else {
        const res = await fetch('/api/admin/sos/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, config }),
        })
        if (!res.ok) throw new Error('Failed to create preset')
        const data = await res.json() as { preset: SosRulesPreset }
        setPresets(prev => [data.preset, ...prev])
      }
      toast.success(`Preset "${name}" saved`)
    } catch {
      toast.error('Failed to save preset')
    } finally {
      setIsSaving(false)
    }
  }, [presets])

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/admin/sos/presets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete preset')
      setPresets(prev => prev.filter(p => p.id !== id))
      toast.success('Preset deleted')
    } catch {
      toast.error('Failed to delete preset')
    }
  }, [])

  return { presets, isLoading, isSaving, savePreset, deletePreset, reloadPresets: loadPresets }
}

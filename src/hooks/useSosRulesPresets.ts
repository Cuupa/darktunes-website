'use client'

/**
 * CRUD hook for SOS rule presets stored in Supabase (sos_rules_presets table).
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { interpolate } from '@/lib/i18n/interpolate'
import {
  durableAccountingSettings,
  type SosAccountingSettings,
} from '@/lib/sos/sosAccountingSettings'

export type PresetConfig = SosAccountingSettings

export interface SosRulesPreset {
  id: string
  name: string
  config: PresetConfig
  created_at: string
  updated_at: string
}

export function useSosRulesPresets() {
  const t = useAccountingLabels()
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
      const res = await fetch('/api/admin/sos/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config: durableAccountingSettings(config) }),
      })
      if (!res.ok) throw new Error('Failed to save preset')
      const data = await res.json() as { preset: SosRulesPreset }
      setPresets((prev) => {
        const idx = prev.findIndex((p) => p.id === data.preset.id)
        if (idx >= 0) {
          return prev.map((p) => (p.id === data.preset.id ? data.preset : p))
        }
        const byName = prev.findIndex(
          (p) => p.name.toLowerCase() === data.preset.name.toLowerCase(),
        )
        if (byName >= 0) {
          return prev.map((p, i) => (i === byName ? data.preset : p))
        }
        return [data.preset, ...prev]
      })
      toast.success(interpolate(t.presetSaveSuccess, { name }))
    } catch {
      toast.error(t.presetSaveFailed)
    } finally {
      setIsSaving(false)
    }
  }, [t])

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/admin/sos/presets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete preset')
      setPresets((prev) => prev.filter((p) => p.id !== id))
      toast.success(t.presetDeleted)
    } catch {
      toast.error(t.presetDeleteFailed)
    }
  }, [t])

  return { presets, isLoading, isSaving, savePreset, deletePreset, reloadPresets: loadPresets }
}
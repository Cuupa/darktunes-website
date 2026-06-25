'use client'

/**
 * CRUD hook for SOS rule presets stored in Supabase (sos_rules_presets table).
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { SosAccountingSettings } from '@/lib/sos/sosAccountingSettings'

export type PresetConfig = SosAccountingSettings

export interface SosRulesPreset {
  id: string
  name: string
  config: PresetConfig
  created_at: string
  updated_at: string
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
      const res = await fetch('/api/admin/sos/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
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
      toast.success(`Preset "${name}" saved`)
    } catch {
      toast.error('Failed to save preset')
    } finally {
      setIsSaving(false)
    }
  }, [])

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    try {
      const res = await fetch(`/api/admin/sos/presets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete preset')
      setPresets((prev) => prev.filter((p) => p.id !== id))
      toast.success('Preset deleted')
    } catch {
      toast.error('Failed to delete preset')
    }
  }, [])

  return { presets, isLoading, isSaving, savePreset, deletePreset, reloadPresets: loadPresets }
}
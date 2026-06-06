'use client'

/**
 * src/components/admin/sos/CsvProfileManager.tsx
 *
 * Save / load named SOS rule presets to localStorage.
 * A preset bundles: artistMappings, compilationFilters, splitFees,
 * manualRevenues, expenses, ignoredEntries, csvAliases, appDefaults, emailConfig.
 */

import { useState, useEffect, useCallback } from 'react'
import { FloppyDisk, FolderOpen, Trash, BookmarkSimple, Warning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type {
  ArtistMapping, CompilationFilter, SplitFee,
  ManualRevenue, ExpenseEntry, IgnoredEntry,
  CSVColumnAlias, AppDefaults, EmailConfig,
} from '@/lib/sos/types'

const STORAGE_KEY = 'darktunes_sos_presets'

export interface SosPreset {
  id: string
  name: string
  savedAt: string
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>
}

interface CsvProfileManagerProps {
  // Current state to save
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>
  // Load callback — replaces current state with preset
  onLoad: (preset: Omit<SosPreset, 'id' | 'name' | 'savedAt'>) => void
}

function loadPresets(): SosPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SosPreset[]) : []
  } catch {
    return []
  }
}

function savePresets(presets: SosPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function CsvProfileManager({
  artistMappings, compilationFilters, splitFees, manualRevenues, expenses,
  ignoredEntries, csvAliases, appDefaults, emailConfig, onLoad,
}: CsvProfileManagerProps) {
  const [presets, setPresets] = useState<SosPreset[]>([])
  const [name, setName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = presets.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
    const newPreset: SosPreset = {
      id: existing?.id ?? crypto.randomUUID(),
      name: trimmed,
      savedAt: new Date().toISOString(),
      artistMappings,
      compilationFilters,
      splitFees,
      manualRevenues,
      expenses,
      ignoredEntries,
      csvAliases,
      appDefaults,
      emailConfig,
    }
    const updated = existing
      ? presets.map(p => p.id === existing.id ? newPreset : p)
      : [...presets, newPreset]
    setPresets(updated)
    savePresets(updated)
    setName('')
  }, [
    name, presets, artistMappings, compilationFilters, splitFees, manualRevenues,
    expenses, ignoredEntries, csvAliases, appDefaults, emailConfig,
  ])

  const handleLoad = useCallback((preset: SosPreset) => {
    onLoad({
      artistMappings: preset.artistMappings ?? [],
      compilationFilters: preset.compilationFilters ?? [],
      splitFees: preset.splitFees ?? [],
      manualRevenues: preset.manualRevenues ?? [],
      expenses: preset.expenses ?? [],
      ignoredEntries: preset.ignoredEntries ?? [],
      csvAliases: preset.csvAliases ?? [],
      appDefaults: preset.appDefaults,
      emailConfig: preset.emailConfig ?? {},
    })
    setLoadedId(preset.id)
    setTimeout(() => setLoadedId(null), 2000)
  }, [onLoad])

  const handleDelete = useCallback((id: string) => {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    savePresets(updated)
    setConfirmDeleteId(null)
  }, [presets])

  const totalRules =
    artistMappings.length + compilationFilters.length + splitFees.length +
    manualRevenues.length + expenses.length + ignoredEntries.length + csvAliases.length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BookmarkSimple size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Rule Presets</h3>
        {totalRules > 0 && (
          <Badge variant="secondary" className="text-xs">{totalRules} rules loaded</Badge>
        )}
      </div>

      {/* Save current state */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Save Current Rules</h4>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Preset name, e.g. Q1-2025"
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="flex-1"
          />
          <Button onClick={handleSave} disabled={!name.trim()} className="gap-1.5">
            <FloppyDisk size={15} weight="bold" /> Save
          </Button>
        </div>
      </div>

      {/* Preset list */}
      {presets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <BookmarkSimple size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No presets saved yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Saved Presets ({presets.length})</h4>
          {presets.map(p => {
            const ruleCount =
              (p.artistMappings?.length ?? 0) +
              (p.compilationFilters?.length ?? 0) +
              (p.splitFees?.length ?? 0) +
              (p.manualRevenues?.length ?? 0) +
              (p.expenses?.length ?? 0) +
              (p.ignoredEntries?.length ?? 0) +
              (p.csvAliases?.length ?? 0)
            return (
              <Card key={p.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ruleCount} rules · saved {new Date(p.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoad(p)}
                    className="h-7 gap-1 text-xs"
                  >
                    {loadedId === p.id
                      ? <><span className="text-green-600">✓</span> Loaded</>
                      : <><FolderOpen size={13} /> Load</>
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash size={13} />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warning size={18} className="text-destructive" /> Delete Preset
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{presets.find(p => p.id === confirmDeleteId)?.name}&quot;?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

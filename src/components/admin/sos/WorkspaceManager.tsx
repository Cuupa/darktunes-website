'use client'

/**
 * src/components/admin/sos/WorkspaceManager.tsx
 *
 * Export the entire SOS rule configuration to a JSON file and
 * import it back in a future session.
 *
 * Exported bundle includes:
 *   appDefaults, emailConfig, artistMappings, compilationFilters,
 *   splitFees, manualRevenues, expenses, ignoredEntries,
 *   csvAliases, trackRevenueAssignments
 */

import { useRef, useCallback } from 'react'
import { DownloadSimple, UploadSimple, Warning } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type {
  ArtistMapping, CompilationFilter, SplitFee,
  ManualRevenue, ExpenseEntry, IgnoredEntry,
  CSVColumnAlias, AppDefaults, EmailConfig,
  TrackRevenueAssignment,
} from '@/lib/sos/types'

const WORKSPACE_VERSION = 1

export interface WorkspaceBundle {
  version: number
  exportedAt: string
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  trackRevenueAssignments: TrackRevenueAssignment[]
}

interface WorkspaceManagerProps {
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  trackRevenueAssignments: TrackRevenueAssignment[]
  onImport: (bundle: Omit<WorkspaceBundle, 'version' | 'exportedAt'>) => void
}

export function WorkspaceManager({
  appDefaults, emailConfig, artistMappings, compilationFilters, splitFees,
  manualRevenues, expenses, ignoredEntries, csvAliases, trackRevenueAssignments,
  onImport,
}: WorkspaceManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    const bundle: WorkspaceBundle = {
      version: WORKSPACE_VERSION,
      exportedAt: new Date().toISOString(),
      appDefaults,
      emailConfig,
      artistMappings,
      compilationFilters,
      splitFees,
      manualRevenues,
      expenses,
      ignoredEntries,
      csvAliases,
      trackRevenueAssignments,
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `darktunes-sos-workspace-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Workspace exported successfully')
  }, [
    appDefaults, emailConfig, artistMappings, compilationFilters, splitFees,
    manualRevenues, expenses, ignoredEntries, csvAliases, trackRevenueAssignments,
  ])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const raw = ev.target?.result as string
        const bundle = JSON.parse(raw) as WorkspaceBundle
        if (!bundle || typeof bundle !== 'object') throw new Error('Invalid workspace file')
        onImport({
          appDefaults: bundle.appDefaults,
          emailConfig: bundle.emailConfig ?? {},
          artistMappings: bundle.artistMappings ?? [],
          compilationFilters: bundle.compilationFilters ?? [],
          splitFees: bundle.splitFees ?? [],
          manualRevenues: bundle.manualRevenues ?? [],
          expenses: bundle.expenses ?? [],
          ignoredEntries: bundle.ignoredEntries ?? [],
          csvAliases: bundle.csvAliases ?? [],
          trackRevenueAssignments: bundle.trackRevenueAssignments ?? [],
        })
        toast.success('Workspace imported successfully')
      } catch {
        toast.error('Failed to parse workspace file. Make sure it is a valid JSON export.')
      }
      // Reset input so the same file can be re-imported
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsText(file)
  }, [onImport])

  const totalRules =
    artistMappings.length + compilationFilters.length + splitFees.length +
    manualRevenues.length + expenses.length + ignoredEntries.length +
    csvAliases.length + trackRevenueAssignments.length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <DownloadSimple size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Workspace Import / Export</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Export the entire SOS configuration (rules, defaults, email settings) to a JSON file for
        backup or to transfer to another session. Import a previously exported workspace to restore
        all rules at once.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <DownloadSimple size={16} className="text-primary" />
            <h4 className="text-sm font-semibold">Export Workspace</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Downloads a JSON snapshot of all {totalRules} rules and settings.
          </p>
          <Button onClick={handleExport} className="gap-1.5 w-full">
            <DownloadSimple size={15} weight="bold" /> Export to JSON
          </Button>
        </Card>

        {/* Import */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UploadSimple size={16} className="text-primary" />
            <h4 className="text-sm font-semibold">Import Workspace</h4>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Warning size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            Importing a workspace replaces all current rules with those from the file.
          </p>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 w-full"
          >
            <UploadSimple size={15} weight="bold" /> Import from JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </Card>
      </div>
    </div>
  )
}

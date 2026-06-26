'use client'

/**
 * src/components/admin/sos/RulesPanel.tsx
 *
 * Combines all SOS rule managers into a single tabbed panel.
 * Embedded inside AccountingPanel as the "Rules" sub-tab.
 */

import { useState } from 'react'
import type {
  ArtistMapping, CompilationFilter, SplitFee,
  ManualRevenue, ExpenseEntry, IgnoredEntry,
  CSVColumnAlias, AppDefaults, EmailConfig,
  TrackRevenueAssignment,
} from '@/lib/sos/types'
import { ArtistMappingManager } from './ArtistMappingManager'
import { CompilationFilterManager } from './CompilationFilterManager'
import { SplitFeeManager } from './SplitFeeManager'
import { ManualRevenueManager } from './ManualRevenueManager'
import { ExpenseManager } from './ExpenseManager'
import { IgnoredEntriesManager } from './IgnoredEntriesManager'
import { CsvAliasManager } from './CsvAliasManager'
import { DefaultSettingsManager } from './DefaultSettingsManager'
import { EmailConfigManager } from './EmailConfigManager'
import { TrackRevenueAssignmentManager } from './TrackRevenueAssignmentManager'

type RulesTab =
  | 'mappings'
  | 'compilations'
  | 'splits'
  | 'revenues'
  | 'expenses'
  | 'ignored'
  | 'track-splits'
  | 'aliases'
  | 'defaults'
  | 'email'

export interface RulesPanelProps {
  // State (passed in from parent so rules persist across sub-tab changes)
  artistMappings: ArtistMapping[]
  compilationFilters: CompilationFilter[]
  splitFees: SplitFee[]
  manualRevenues: ManualRevenue[]
  expenses: ExpenseEntry[]
  ignoredEntries: IgnoredEntry[]
  csvAliases: CSVColumnAlias[]
  trackRevenueAssignments: TrackRevenueAssignment[]
  appDefaults: AppDefaults
  emailConfig: Partial<EmailConfig>

  // Callbacks
  onAddArtistMapping: (m: Omit<ArtistMapping, 'id'>) => void
  onRemoveArtistMapping: (id: string) => void
  onUpdateArtistMapping?: (id: string, m: Omit<ArtistMapping, 'id'>) => void

  onAddCompilationFilter: (f: Omit<CompilationFilter, 'id'>) => void
  onRemoveCompilationFilter: (id: string) => void

  onAddSplitFee: (fee: SplitFee) => void
  onRemoveSplitFee: (artist: string) => void
  onUpdateSplitFee?: (artist: string, update: Omit<SplitFee, 'artist'>) => void

  onAddManualRevenue: (r: Omit<ManualRevenue, 'id'>) => void
  onRemoveManualRevenue: (id: string) => void
  onUpdateManualRevenue?: (id: string, r: Omit<ManualRevenue, 'id'>) => void

  onAddExpense: (e: Omit<ExpenseEntry, 'id'>) => void
  onRemoveExpense: (id: string) => void
  onUpdateExpense?: (id: string, e: Omit<ExpenseEntry, 'id'>) => void

  onAddIgnoredEntry: (e: Omit<IgnoredEntry, 'id' | 'createdAt'>) => void
  onRemoveIgnoredEntry: (id: string) => void

  onAddCsvAlias: (alias: Omit<CSVColumnAlias, 'id'>) => void
  onRemoveCsvAlias: (id: string) => void

  onAddTrackAssignment: (a: TrackRevenueAssignment) => void
  onRemoveTrackAssignment: (id: string) => void

  onUpdateAppDefaults: (next: AppDefaults) => void
  onUpdateEmailConfig: (next: Partial<EmailConfig>) => void

  // Context data from useCSVProcessor
  availableArtists?: string[]
  availableReleases?: string[]
  autoMappings?: ArtistMapping[]
}

const TABS: { id: RulesTab; label: string }[] = [
  { id: 'mappings',     label: 'Artist Mappings' },
  { id: 'compilations', label: 'Compilations' },
  { id: 'splits',       label: 'Splits' },
  { id: 'track-splits', label: 'Track Splits' },
  { id: 'revenues',     label: 'Manual Revenue' },
  { id: 'expenses',     label: 'Expenses' },
  { id: 'ignored',      label: 'Ignored' },
  { id: 'aliases',      label: 'CSV Columns' },
  { id: 'defaults',     label: 'Defaults' },
  { id: 'email',        label: 'Email' },
]

export function RulesPanel({
  artistMappings, compilationFilters, splitFees, manualRevenues, expenses,
  ignoredEntries, csvAliases, trackRevenueAssignments, appDefaults, emailConfig,
  onAddArtistMapping, onRemoveArtistMapping, onUpdateArtistMapping,
  onAddCompilationFilter, onRemoveCompilationFilter,
  onAddSplitFee, onRemoveSplitFee, onUpdateSplitFee,
  onAddManualRevenue, onRemoveManualRevenue, onUpdateManualRevenue,
  onAddExpense, onRemoveExpense, onUpdateExpense,
  onAddIgnoredEntry, onRemoveIgnoredEntry,
  onAddCsvAlias, onRemoveCsvAlias,
  onAddTrackAssignment, onRemoveTrackAssignment,
  onUpdateAppDefaults,
  onUpdateEmailConfig,
  availableArtists = [],
  availableReleases = [],
  autoMappings = [],
}: RulesPanelProps) {
  const [activeTab, setActiveTab] = useState<RulesTab>('mappings')

  const counts: Partial<Record<RulesTab, number>> = {
    mappings:     artistMappings.length + autoMappings.length,
    compilations: compilationFilters.length,
    splits:       splitFees.length,
    revenues:     manualRevenues.length,
    expenses:     expenses.length,
    ignored:      ignoredEntries.length,
    'track-splits': trackRevenueAssignments.length,
    aliases:      csvAliases.length,
  }

  return (
    <div className="space-y-0">
      {/* Rules sub-navigation */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 pt-1 overflow-x-auto overscroll-contain" data-lenis-prevent>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === id
                ? 'border border-b-0 border-border bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            {(counts[id] ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'mappings' && (
          <ArtistMappingManager
            mappings={artistMappings}
            onAddMapping={onAddArtistMapping}
            onRemoveMapping={onRemoveArtistMapping}
            onUpdateMapping={onUpdateArtistMapping}
            artists={availableArtists}
            autoMappings={autoMappings}
          />
        )}
        {activeTab === 'compilations' && (
          <CompilationFilterManager
            filters={compilationFilters}
            onAddFilter={onAddCompilationFilter}
            onRemoveFilter={onRemoveCompilationFilter}
            availableReleases={availableReleases}
          />
        )}
        {activeTab === 'splits' && (
          <SplitFeeManager
            splitFees={splitFees}
            onAddSplitFee={onAddSplitFee}
            onRemoveSplitFee={onRemoveSplitFee}
            onUpdateSplitFee={onUpdateSplitFee}
            artists={availableArtists}
          />
        )}
        {activeTab === 'track-splits' && (
          <TrackRevenueAssignmentManager
            assignments={trackRevenueAssignments}
            onAddAssignment={onAddTrackAssignment}
            onRemoveAssignment={onRemoveTrackAssignment}
            availableArtists={availableArtists}
          />
        )}
        {activeTab === 'revenues' && (
          <ManualRevenueManager
            revenues={manualRevenues}
            onAddRevenue={onAddManualRevenue}
            onRemoveRevenue={onRemoveManualRevenue}
            onUpdateRevenue={onUpdateManualRevenue}
            artists={availableArtists}
          />
        )}
        {activeTab === 'expenses' && (
          <ExpenseManager
            expenses={expenses}
            onAddExpense={onAddExpense}
            onRemoveExpense={onRemoveExpense}
            onUpdateExpense={onUpdateExpense}
            artists={availableArtists}
          />
        )}
        {activeTab === 'ignored' && (
          <IgnoredEntriesManager
            entries={ignoredEntries}
            onAddEntry={onAddIgnoredEntry}
            onRemoveEntry={onRemoveIgnoredEntry}
            artists={availableArtists}
            releaseTitles={availableReleases}
          />
        )}
        {activeTab === 'aliases' && (
          <CsvAliasManager
            aliases={csvAliases}
            onAddAlias={onAddCsvAlias}
            onRemoveAlias={onRemoveCsvAlias}
          />
        )}
        {activeTab === 'defaults' && (
          <DefaultSettingsManager
            defaults={appDefaults}
            onUpdate={onUpdateAppDefaults}
          />
        )}
        {activeTab === 'email' && (
          <EmailConfigManager
            config={emailConfig}
            onUpdate={onUpdateEmailConfig}
          />
        )}
      </div>
    </div>
  )
}

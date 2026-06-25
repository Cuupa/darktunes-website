import type {
  AppDefaults,
  ArtistMapping,
  CompilationFilter,
  CSVColumnAlias,
  EmailConfig,
  ExpenseEntry,
  IgnoredEntry,
  ManualRevenue,
  SplitFee,
  TrackRevenueAssignment,
} from '@/lib/sos/types'
import { DEFAULT_APP_DEFAULTS, DEFAULT_EMAIL_CONFIG } from '@/lib/sos/defaults'

export interface SosRulesBundle {
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
}

export const EMPTY_SOS_RULES_BUNDLE: SosRulesBundle = {
  artistMappings: [],
  compilationFilters: [],
  splitFees: [],
  manualRevenues: [],
  expenses: [],
  ignoredEntries: [],
  csvAliases: [],
  trackRevenueAssignments: [],
  appDefaults: DEFAULT_APP_DEFAULTS,
  emailConfig: DEFAULT_EMAIL_CONFIG,
}

export type { SosAccountingSettings } from '@/lib/sos/sosAccountingSettings'
export { DEFAULT_SOS_ACCOUNTING_SETTINGS } from '@/lib/sos/sosAccountingSettings'
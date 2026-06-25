import type { CsvImportProfile } from '@/lib/sos/ingest/types'
import {
  DEFAULT_APP_DEFAULTS,
  DEFAULT_EMAIL_CONFIG,
  DEFAULT_LABEL_INFO,
  DEFAULT_PDF_EXPORT_SETTINGS,
} from '@/lib/sos/defaults'
import type {
  AppDefaults,
  ArtistMapping,
  CompilationFilter,
  CSVColumnAlias,
  EmailConfig,
  ExpenseEntry,
  IgnoredEntry,
  LabelInfo,
  ManualRevenue,
  PdfExportSettings,
  SplitFee,
  TrackRevenueAssignment,
} from '@/lib/sos/types'

export const DEFAULT_PRESET_NAME = 'Default'

export interface SosAccountingSettings {
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
  labelInfo: Partial<LabelInfo>
  pdfSettings: PdfExportSettings
  csvImportProfiles: CsvImportProfile[]
}

export const DEFAULT_SOS_ACCOUNTING_SETTINGS: SosAccountingSettings = {
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
  labelInfo: DEFAULT_LABEL_INFO,
  pdfSettings: DEFAULT_PDF_EXPORT_SETTINGS,
  csvImportProfiles: [],
}

export function normalizeAccountingConfig(
  raw: Partial<SosAccountingSettings> | null | undefined,
): SosAccountingSettings {
  return {
    artistMappings: raw?.artistMappings ?? [],
    compilationFilters: raw?.compilationFilters ?? [],
    splitFees: raw?.splitFees ?? [],
    manualRevenues: raw?.manualRevenues ?? [],
    expenses: raw?.expenses ?? [],
    ignoredEntries: raw?.ignoredEntries ?? [],
    csvAliases: raw?.csvAliases ?? [],
    trackRevenueAssignments: raw?.trackRevenueAssignments ?? [],
    appDefaults: { ...DEFAULT_APP_DEFAULTS, ...raw?.appDefaults },
    emailConfig: { ...DEFAULT_EMAIL_CONFIG, ...raw?.emailConfig },
    labelInfo: { ...DEFAULT_LABEL_INFO, ...raw?.labelInfo },
    pdfSettings: { ...DEFAULT_PDF_EXPORT_SETTINGS, ...raw?.pdfSettings },
    csvImportProfiles: raw?.csvImportProfiles ?? [],
  }
}

export function settingsFingerprint(settings: SosAccountingSettings): string {
  return JSON.stringify(settings)
}
import type { CsvImportProfile } from '@/lib/sos/ingest/types'
import {
  DEFAULT_APP_DEFAULTS,
  DEFAULT_EMAIL_CONFIG,
  DEFAULT_LABEL_INFO,
  DEFAULT_PDF_EXPORT_SETTINGS,
} from '@/lib/sos/defaults'
import {
  DEFAULT_EXCEL_EXPORT_STATE,
  normalizeExcelExportState,
  type ExcelExportState,
  type ExcelExportStatePatch,
} from '@/lib/sos/excelExportSettings'
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
  excelExport: ExcelExportState
}

/** One-off settlement lines. Must not ride along on Default / named presets. */
export type PeriodScopedAccountingSettings = Pick<
  SosAccountingSettings,
  'manualRevenues' | 'expenses' | 'ignoredEntries'
>

const EMPTY_PERIOD_SCOPED: PeriodScopedAccountingSettings = {
  manualRevenues: [],
  expenses: [],
  ignoredEntries: [],
}

export function periodScopedSettings(
  settings: SosAccountingSettings,
): PeriodScopedAccountingSettings {
  return {
    manualRevenues: settings.manualRevenues,
    expenses: settings.expenses,
    ignoredEntries: settings.ignoredEntries,
  }
}

export function durableAccountingSettings(
  settings: SosAccountingSettings,
): SosAccountingSettings {
  return {
    ...settings,
    ...EMPTY_PERIOD_SCOPED,
  }
}

export function mergePeriodScopedSettings(
  durable: SosAccountingSettings,
  period: PeriodScopedAccountingSettings,
): SosAccountingSettings {
  return {
    ...durable,
    manualRevenues: period.manualRevenues,
    expenses: period.expenses,
    ignoredEntries: period.ignoredEntries,
  }
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
  excelExport: DEFAULT_EXCEL_EXPORT_STATE,
}

export function normalizeAccountingConfig(
  raw: (Omit<Partial<SosAccountingSettings>, 'excelExport' | 'appDefaults'> & {
    excelExport?: ExcelExportStatePatch
    appDefaults?: Partial<AppDefaults>
    /** Standalone SOS generator export used this name. */
    pdfExportSettings?: PdfExportSettings
  }) | null | undefined,
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
    appDefaults: {
      ...DEFAULT_APP_DEFAULTS,
      ...raw?.appDefaults,
      sourceSplits: {
        ...DEFAULT_APP_DEFAULTS.sourceSplits,
        ...raw?.appDefaults?.sourceSplits,
      },
    },
    emailConfig: { ...DEFAULT_EMAIL_CONFIG, ...raw?.emailConfig },
    labelInfo: { ...DEFAULT_LABEL_INFO, ...raw?.labelInfo },
    pdfSettings: {
      ...DEFAULT_PDF_EXPORT_SETTINGS,
      ...raw?.pdfSettings,
      ...raw?.pdfExportSettings,
    },
    csvImportProfiles: raw?.csvImportProfiles ?? [],
    excelExport: normalizeExcelExportState(raw?.excelExport),
  }
}

export function settingsFingerprint(settings: SosAccountingSettings): string {
  return JSON.stringify(settings)
}
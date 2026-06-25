/**
 * One-time migration of legacy IndexedDB SOS settings into Supabase presets.
 */

import { get, del } from 'idb-keyval'
import type { CsvImportProfile } from '@/lib/sos/ingest/types'
import {
  DEFAULT_SOS_ACCOUNTING_SETTINGS,
  normalizeAccountingConfig,
  type SosAccountingSettings,
} from '@/lib/sos/sosAccountingSettings'
import type { SosRulesBundle } from '@/lib/sos/sosRulesBundle'
import type { LabelInfo } from '@/lib/sos/types'

export const SOS_KV_MIGRATED_FLAG = 'sos_kv_migrated_v1'
const RULES_KEY = 'sos-rules-state'
const LABEL_KEY = 'sos-label-info'
const CSV_PROFILES_KEY = 'darktunes_csv_import_profiles'

export interface KvMigrationPayload {
  hasData: boolean
  settings: SosAccountingSettings
}

export async function readLegacyKvSettings(): Promise<KvMigrationPayload> {
  const [rulesRaw, labelRaw, profilesRaw] = await Promise.all([
    get<SosRulesBundle>(RULES_KEY),
    get<LabelInfo>(LABEL_KEY),
    get<CsvImportProfile[]>(CSV_PROFILES_KEY),
  ])

  const hasRules = rulesRaw != null && typeof rulesRaw === 'object'
  const hasLabel = labelRaw != null && typeof labelRaw === 'object'
  const hasProfiles = Array.isArray(profilesRaw) && profilesRaw.length > 0
  const hasData = hasRules || hasLabel || hasProfiles

  const settings = normalizeAccountingConfig({
    ...(hasRules ? rulesRaw : {}),
    labelInfo: hasLabel ? labelRaw : undefined,
    csvImportProfiles: hasProfiles ? profilesRaw : undefined,
  })

  return { hasData, settings }
}

export function mergeKvIntoSettings(
  current: SosAccountingSettings,
  legacy: SosAccountingSettings,
): SosAccountingSettings {
  const currentEmpty =
    current.artistMappings.length === 0 &&
    current.compilationFilters.length === 0 &&
    current.splitFees.length === 0 &&
    current.csvImportProfiles.length === 0

  if (!currentEmpty) {
    return current
  }

  return normalizeAccountingConfig({
    ...DEFAULT_SOS_ACCOUNTING_SETTINGS,
    ...legacy,
    labelInfo: { ...legacy.labelInfo, ...current.labelInfo },
    pdfSettings: { ...legacy.pdfSettings, ...current.pdfSettings },
  })
}

export async function clearLegacyKvKeys(): Promise<void> {
  await Promise.all([
    del(RULES_KEY),
    del(LABEL_KEY),
    del(CSV_PROFILES_KEY),
  ])
}

export function isKvMigrationComplete(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(SOS_KV_MIGRATED_FLAG) === '1'
}

export function markKvMigrationComplete(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SOS_KV_MIGRATED_FLAG, '1')
}
/**
 * Tenant-neutral technical identifiers (cookies, storage keys, IndexedDB names).
 * Legacy darktunes_* names are migrated at read time where noted in PR4.
 */

export const CONSENT_COOKIE_NAME = 'site_consent'
export const CONSENT_LEGACY_COOKIE_NAME = 'darktunes_consent'
export const CONSENT_EXTERNAL_STORAGE_KEY = 'site_consent_external'
export const CONSENT_LEGACY_EXTERNAL_STORAGE_KEY = 'darktunes_consent_external'
export const CONSENT_CHANGE_EVENT = 'site_consent_change'
export const CONSENT_LEGACY_CHANGE_EVENT = 'darktunes_consent_change'

export const TOUR_PLANNER_DB_NAME = 'label-tour-planner'
export const TOUR_PLANNER_LEGACY_DB_NAME = 'darktunes-tour-planner'

export const SOS_CSV_PRESETS_STORAGE_KEY = 'sos_csv_presets'
export const SOS_CSV_PRESETS_LEGACY_STORAGE_KEY = 'darktunes_sos_presets'

export const ADMIN_COLOR_PRESETS_STORAGE_KEY = 'admin-custom-color-presets'
export const ADMIN_COLOR_PRESETS_LEGACY_STORAGE_KEY = 'darktunes-admin-custom-color-presets'

export const DATA_EXPORT_FILENAME_PREFIX = 'label-data-export'
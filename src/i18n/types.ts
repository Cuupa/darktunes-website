import type enDict from './dictionaries/en.json'

/** Supported locales */
export type Locale = 'en' | 'de'

/**
 * Full dictionary type — structurally derived from the English baseline.
 * This guarantees that the German dictionary has every key the English one has.
 */
export type Dictionary = typeof enDict

/** Convenience alias for portal dictionary keys (EPK keys included via en.json baseline). */
export type PortalDictionary = Dictionary['portal']

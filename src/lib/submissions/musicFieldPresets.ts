import type { SubmissionFieldScope, SubmissionFieldType } from '@/lib/submissions/fieldTypes'
import { fieldKeyFromLabel } from '@/lib/submissions/fieldKey'

export interface MusicFieldPreset {
  id: string
  fieldKey: string
  fieldLabels: Record<string, string>
  fieldType: SubmissionFieldType
  fieldScope: SubmissionFieldScope
  fieldGroup: string
  placeholders?: Record<string, string>
  isRequired?: boolean
}

function preset(
  id: string,
  labels: Record<string, string>,
  fieldType: SubmissionFieldType,
  fieldScope: SubmissionFieldScope,
  fieldGroup: string,
  placeholders?: Record<string, string>,
  isRequired = false,
): MusicFieldPreset {
  const primaryLabel = labels.en ?? Object.values(labels)[0] ?? id
  return {
    id,
    fieldKey: fieldKeyFromLabel(primaryLabel),
    fieldLabels: labels,
    fieldType,
    fieldScope,
    fieldGroup,
    placeholders,
    isRequired,
  }
}

export const MUSIC_FIELD_PRESETS: MusicFieldPreset[] = [
  preset('catalogue_number', { en: 'Catalogue Number', de: 'Katalognummer' }, 'text', 'release', 'metadata', { en: 'DT-001', de: 'DT-001' }),
  preset('ean', { en: 'EAN', de: 'EAN' }, 'ean', 'release', 'metadata'),
  preset('prod_year', { en: 'Prod Year', de: 'Produktionsjahr' }, 'year', 'release', 'metadata'),
  preset('artist_name', { en: 'Artist Name', de: 'Künstlername' }, 'text', 'release', 'metadata'),
  preset('language', { en: 'Language', de: 'Sprache' }, 'text', 'release', 'metadata', { en: 'e.g. DE, EN', de: 'z.B. DE, EN' }),
  preset('gema_release', { en: 'GEMA', de: 'GEMA' }, 'boolean', 'release', 'rights'),
  preset('track_number', { en: 'Track Nr', de: 'Track-Nr.' }, 'number', 'track', 'track', undefined, true),
  preset('song_title', { en: 'Song Title', de: 'Songtitel' }, 'text', 'track', 'track', undefined, true),
  preset('composer', { en: 'Composer', de: 'Komponist' }, 'text', 'track', 'track'),
  preset('author', { en: 'Author', de: 'Autor' }, 'text', 'track', 'track'),
  preset('track_genre', { en: 'Genre', de: 'Genre' }, 'text', 'track', 'track'),
  preset('track_language', { en: 'Language', de: 'Sprache' }, 'text', 'track', 'track'),
  preset('gema_track', { en: 'GEMA', de: 'GEMA' }, 'boolean', 'track', 'rights'),
  preset('explicit', { en: 'Explicit', de: 'Explicit' }, 'boolean', 'track', 'rights'),
  preset('live', { en: 'Live', de: 'Live' }, 'boolean', 'track', 'rights'),
  preset('cover_version', { en: 'Cover', de: 'Cover' }, 'boolean', 'track', 'rights'),
  preset('instrumental', { en: 'Instrumental', de: 'Instrumental' }, 'boolean', 'track', 'rights'),
  preset('preview_start_seconds', { en: 'Preview Start (seconds)', de: 'Preview-Start (Sekunden)' }, 'seconds', 'track', 'distribution'),
  preset('duration', { en: 'Duration', de: 'Dauer' }, 'duration', 'track', 'track', { en: 'HH:MM:SS', de: 'HH:MM:SS' }),
]
import type { Database } from '@/types/database'
import { normalizeFieldValue } from '@/lib/submissions/fieldValidation'
import type { SubmissionFieldType } from '@/lib/submissions/fieldTypes'
import type { SubmissionFormField } from '@/types'

type TrackInsert = Database['public']['Tables']['release_submission_tracks']['Insert']

/** Assigned from track list position — never shown to artists. */
export const SYSTEM_MANAGED_TRACK_FIELD_KEYS = new Set(['track_number'])

export function filterArtistTrackFields(fields: SubmissionFormField[]): SubmissionFormField[] {
  return fields.filter((f) => !SYSTEM_MANAGED_TRACK_FIELD_KEYS.has(f.fieldKey))
}

const TRACK_KEY_TO_COLUMN: Record<string, keyof TrackInsert> = {
  track_number: 'track_number',
  song_title: 'title',
  track_isrc: 'isrc',
  isrc: 'isrc',
  composer: 'composer',
  author: 'author',
  track_genre: 'genre',
  genre: 'genre',
  track_language: 'language',
  language: 'language',
  gema: 'gema',
  gema_track: 'gema',
  explicit: 'explicit',
  live: 'live',
  cover_version: 'cover',
  cover: 'cover',
  instrumental: 'instrumental',
  preview_start_seconds: 'preview_start_seconds',
  duration: 'duration_seconds',
}

export function buildTrackInsert(
  submissionId: string,
  trackNumber: number,
  displayOrder: number,
  fieldValues: Record<string, { value: string; fieldType: SubmissionFieldType }>,
): TrackInsert {
  const row: TrackInsert = {
    submission_id: submissionId,
    track_number: trackNumber,
    display_order: displayOrder,
    form_data: null,
  }
  const extras: Record<string, unknown> = {}

  for (const [key, { value, fieldType }] of Object.entries(fieldValues)) {
    if (SYSTEM_MANAGED_TRACK_FIELD_KEYS.has(key)) continue
    if (!value.trim()) continue
    const column = TRACK_KEY_TO_COLUMN[key]
    const normalized = normalizeFieldValue(fieldType, value)
    if (column) {
      ;(row as Record<string, unknown>)[column] = normalized
    } else {
      extras[key] = normalized
    }
  }

  if (Object.keys(extras).length > 0) {
    row.form_data = extras
  }
  return row
}
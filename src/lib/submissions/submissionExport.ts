import type { ReleaseSubmission, ReleaseSubmissionTrack, SubmissionFormField } from '@/types'
import { formatSecondsToDuration } from '@/lib/submissions/fieldValidation'

export interface SubmissionExportRow {
  submissionId: string
  artistName: string
  status: string
  submittedAt: string
  releaseTitle: string
  releaseType: string | null
  releaseDate: string | null
  trackNumber: number | null
  [key: string]: string | number | null
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export const TRACK_EXPORT_COLUMNS: { key: keyof ReleaseSubmissionTrack; header: string }[] = [
  { key: 'trackNumber', header: 'Track Nr' },
  { key: 'title', header: 'Song Title' },
  { key: 'isrc', header: 'ISRC' },
  { key: 'composer', header: 'Composer' },
  { key: 'author', header: 'Author' },
  { key: 'genre', header: 'Track Genre' },
  { key: 'language', header: 'Track Language' },
  { key: 'gema', header: 'GEMA' },
  { key: 'explicit', header: 'Explicit' },
  { key: 'live', header: 'Live' },
  { key: 'cover', header: 'Cover' },
  { key: 'instrumental', header: 'Instrumental' },
  { key: 'previewStartSeconds', header: 'Preview Start (s)' },
  { key: 'durationSeconds', header: 'Duration' },
]

/** Canonical default column order for CSV/Excel export (team-wide baseline). */
export const DEFAULT_EXPORT_COLUMNS: string[] = [
  'artistName',
  'releaseTitle',
  'releaseType',
  'releaseDate',
  'status',
  'submittedAt',
  'Track Nr',
  'Song Title',
  'Composer',
  'Author',
  'ISRC',
  'Duration',
  'Track Genre',
  'Track Language',
  'GEMA',
  'Explicit',
  'Live',
  'Cover',
  'Instrumental',
  'Preview Start (s)',
  'submissionId',
]

export function listBaseExportColumnKeys(): string[] {
  return [
    'artistName',
    'releaseTitle',
    'releaseType',
    'releaseDate',
    'status',
    'submittedAt',
    'trackNumber',
    ...TRACK_EXPORT_COLUMNS.filter((c) => c.key !== 'trackNumber').map((c) => c.header),
    'submissionId',
  ]
}

/**
 * Resolve export column order.
 * - With a non-empty `saved` list: keep that order for keys in `availableKeys` only
 *   (does **not** re-append unchecked columns).
 * - Without saved: DEFAULT_EXPORT_COLUMNS, then any remaining available keys.
 */
export function resolveExportColumns(
  saved: string[] | null | undefined,
  availableKeys: string[],
): string[] {
  const available = new Set(availableKeys)
  const ordered: string[] = []
  const seen = new Set<string>()

  if (saved && saved.length > 0) {
    for (const key of saved) {
      if (!available.has(key) || seen.has(key)) continue
      ordered.push(key)
      seen.add(key)
    }
    if (ordered.length > 0) return ordered
  }

  for (const key of DEFAULT_EXPORT_COLUMNS) {
    if (!available.has(key) || seen.has(key)) continue
    ordered.push(key)
    seen.add(key)
  }
  for (const key of availableKeys) {
    if (seen.has(key)) continue
    ordered.push(key)
    seen.add(key)
  }
  return ordered.length > 0 ? ordered : [...DEFAULT_EXPORT_COLUMNS]
}

/** Union of base + schema + row keys in a stable default-ish order (for UI pickers). */
export function collectAvailableExportKeys(
  rows: SubmissionExportRow[],
  schemaFields: SubmissionFormField[] = [],
): string[] {
  const keys = new Set<string>(listBaseExportColumnKeys())
  for (const field of schemaFields) {
    if (field.fieldScope === 'release' && field.isVisible) {
      keys.add(field.fieldKey)
    }
  }
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }
  // Available list should show everything; use empty saved so defaults lead + extras follow.
  return resolveExportColumns(null, [...keys])
}

function formatTrackCell(key: keyof ReleaseSubmissionTrack, track: ReleaseSubmissionTrack): string {
  const val = track[key]
  if (val === null || val === undefined) return ''
  if (key === 'durationSeconds' && typeof val === 'number') return formatSecondsToDuration(val)
  if (typeof val === 'boolean') return val ? 'yes' : 'no'
  return String(val)
}

export function buildSubmissionExportRows(input: {
  submissions: ReleaseSubmission[]
  tracksBySubmission: Map<string, ReleaseSubmissionTrack[]>
  artistNames: Map<string, string>
  schemaFields: SubmissionFormField[]
}): SubmissionExportRow[] {
  const extraReleaseKeys = input.schemaFields
    .filter((f) => f.fieldScope === 'release' && f.isVisible)
    .map((f) => f.fieldKey)

  const rows: SubmissionExportRow[] = []

  for (const sub of input.submissions) {
    const tracks = input.tracksBySubmission.get(sub.id) ?? []
    const fromForm =
      typeof sub.formData?.artist_name === 'string' ? sub.formData.artist_name : null
    const artistName =
      input.artistNames.get(sub.artistId) || fromForm || sub.artistName || ''
    const base: SubmissionExportRow = {
      submissionId: sub.id,
      artistName,
      status: sub.status,
      submittedAt: sub.createdAt,
      releaseTitle: sub.title,
      releaseType: sub.type,
      releaseDate: sub.releaseDate,
      trackNumber: null,
    }

    const releaseExtras: Record<string, string> = {}
    for (const key of extraReleaseKeys) {
      const fromForm = sub.formData?.[key]
      releaseExtras[key] = fromForm !== undefined && fromForm !== null ? String(fromForm) : ''
    }

    if (tracks.length === 0) {
      rows.push({ ...base, trackNumber: null, ...releaseExtras })
      continue
    }

    for (const track of tracks) {
      const trackCols: Record<string, string | number | null> = { trackNumber: track.trackNumber }
      for (const col of TRACK_EXPORT_COLUMNS) {
        if (col.key === 'trackNumber') {
          trackCols['Track Nr'] = track.trackNumber
          continue
        }
        trackCols[col.header] = formatTrackCell(col.key, track)
      }
      if (track.formData) {
        for (const [k, v] of Object.entries(track.formData)) {
          trackCols[k] = v !== null && v !== undefined ? String(v) : ''
        }
      }
      rows.push({ ...base, ...trackCols, ...releaseExtras })
    }
  }

  return rows
}

function resolveHeaders(
  rows: SubmissionExportRow[],
  columnOrder?: string[] | null,
): string[] {
  if (columnOrder && columnOrder.length > 0) {
    return columnOrder
  }
  if (rows.length === 0) {
    return DEFAULT_EXPORT_COLUMNS
  }
  return collectAvailableExportKeys(rows)
}

export function buildSubmissionsCsv(
  rows: SubmissionExportRow[],
  columnOrder?: string[] | null,
): string {
  const headers = resolveHeaders(rows, columnOrder)
  if (rows.length === 0) {
    return `${headers.join(',')}\n`
  }

  const lines = [rowToCsv(headers)]
  for (const row of rows) {
    lines.push(rowToCsv(headers.map((h) => row[h] ?? '')))
  }
  return lines.join('\n')
}

export async function buildSubmissionsExcel(
  rows: SubmissionExportRow[],
  columnOrder?: string[] | null,
): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Submissions')
  const headers = resolveHeaders(rows, columnOrder)

  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ''))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

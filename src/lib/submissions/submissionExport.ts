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

const TRACK_COLUMNS: { key: keyof ReleaseSubmissionTrack; header: string }[] = [
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
    const artistName = input.artistNames.get(sub.artistId) ?? ''
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
      for (const col of TRACK_COLUMNS) {
        if (col.key === 'trackNumber') continue
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

export function buildSubmissionsCsv(rows: SubmissionExportRow[]): string {
  if (rows.length === 0) return 'submissionId,artistName,status,submittedAt,releaseTitle\n'

  const headers = Object.keys(rows[0])
  const lines = [rowToCsv(headers)]
  for (const row of rows) {
    lines.push(rowToCsv(headers.map((h) => row[h])))
  }
  return lines.join('\n')
}

export async function buildSubmissionsExcel(rows: SubmissionExportRow[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Submissions')

  if (rows.length === 0) {
    sheet.addRow(['submissionId', 'artistName', 'status'])
  } else {
    const headers = Object.keys(rows[0])
    sheet.addRow(headers)
    for (const row of rows) {
      sheet.addRow(headers.map((h) => row[h] ?? ''))
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
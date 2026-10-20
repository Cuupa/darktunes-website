const ALLOWED_DETAIL_KEYS = new Set([
  'error_id',
  'fingerprint',
  'request_id',
  'route',
  'source',
  'error_type',
  'http_status',
  'operation',
  'environment',
  'app_version',
  'deployment_id',
  'occurrences',
])

export function projectDiagnosticRecord(row: Record<string, unknown>): Record<string, unknown> {
  const projected: Record<string, unknown> = {}
  for (const key of ALLOWED_DETAIL_KEYS) {
    if (key in row) projected[key] = row[key]
  }
  if (typeof row.message === 'string') projected.message = row.message.slice(0, 500)
  return projected
}

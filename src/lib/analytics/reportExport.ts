import type { ArtistListenerMetric } from '@/lib/api/artistListenerMetrics'
import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'
import type { StreamingStat } from '@/lib/api/streamingStats'
import type { SalesStatement } from '@/lib/api/salesStatements'

function escapeCsvCell(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(cells: (string | number)[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function buildPortalAnalyticsCsv(input: {
  stats: StreamingStat[]
  territoryMetrics: ArtistTerritoryMetric[]
  listenerMetrics: ArtistListenerMetric[]
  statements: SalesStatement[]
}): string {
  const lines: string[] = []

  lines.push('# Streaming Stats')
  lines.push(rowToCsv(['period', 'platform', 'streams']))
  for (const s of input.stats) {
    lines.push(rowToCsv([s.period, s.platform, s.streams]))
  }

  lines.push('')
  lines.push('# Territory Metrics')
  lines.push(rowToCsv(['period', 'platform', 'country', 'streams', 'revenue_eur']))
  for (const m of input.territoryMetrics) {
    lines.push(rowToCsv([m.period, m.platform, m.country, m.streams, m.revenueEur]))
  }

  lines.push('')
  lines.push('# Listener Metrics')
  lines.push(rowToCsv(['period', 'source', 'metric_type', 'value', 'country']))
  for (const m of input.listenerMetrics) {
    lines.push(rowToCsv([m.period, m.source, m.metricType, m.value, m.country]))
  }

  lines.push('')
  lines.push('# Statements')
  lines.push(rowToCsv(['period', 'filename', 'status', 'amount_eur']))
  for (const s of input.statements) {
    lines.push(rowToCsv([s.period, s.filename, s.status, s.amountEur ?? '']))
  }

  return lines.join('\n')
}

export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
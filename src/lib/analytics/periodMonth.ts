/** Calendar period key YYYY-MM in UTC (client- and server-safe). */
export function utcPeriodMonth(date: Date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

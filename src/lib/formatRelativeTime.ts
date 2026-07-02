const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
]

export function formatRelativeTime(
  dateInput: string | Date,
  locale = 'en',
  now = Date.now(),
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const timestamp = date.getTime()
  if (Number.isNaN(timestamp)) return ''

  const elapsedSeconds = Math.round((timestamp - now) / 1000)
  const absSeconds = Math.abs(elapsedSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  for (const { unit, seconds } of UNITS) {
    if (absSeconds >= seconds || unit === 'second') {
      const value = Math.round(elapsedSeconds / seconds)
      return formatter.format(value, unit)
    }
  }

  return ''
}
import {
  SECONDS_PER_YEAR,
  SECONDS_PER_MONTH,
  SECONDS_PER_WEEK,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@/lib/datetime/constants'

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: SECONDS_PER_YEAR },
  { unit: 'month', seconds: SECONDS_PER_MONTH },
  { unit: 'week', seconds: SECONDS_PER_WEEK },
  { unit: 'day', seconds: SECONDS_PER_DAY },
  { unit: 'hour', seconds: SECONDS_PER_HOUR },
  { unit: 'minute', seconds: SECONDS_PER_MINUTE },
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
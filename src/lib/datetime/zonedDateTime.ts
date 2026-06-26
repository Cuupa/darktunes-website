const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((p) => p.type === type)?.value ?? '0'
  return Number(value)
}

/**
 * Converts a wall-clock datetime in an IANA timezone to a UTC ISO string.
 * Input format: YYYY-MM-DDTHH:mm (datetime-local).
 */
export function zonedLocalToUtcIso(local: string, timeZone: string): string {
  const match = local.match(LOCAL_DATETIME_RE)
  if (!match) throw new Error(`Invalid datetime-local value: ${local}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  let utcMs = Date.UTC(year, month - 1, day, hour, minute)
  const targetMs = Date.UTC(year, month - 1, day, hour, minute)

  for (let i = 0; i < 5; i++) {
    const parts = formatter.formatToParts(new Date(utcMs))
    const zonedHour = readPart(parts, 'hour') % 24
    const zonedMs = Date.UTC(
      readPart(parts, 'year'),
      readPart(parts, 'month') - 1,
      readPart(parts, 'day'),
      zonedHour,
      readPart(parts, 'minute'),
    )
    const delta = targetMs - zonedMs
    if (delta === 0) break
    utcMs += delta
  }

  return new Date(utcMs).toISOString()
}

/** Converts a UTC ISO string to datetime-local format in the given IANA timezone. */
export function utcIsoToZonedLocal(iso: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date(iso))
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = readPart(parts, 'year')
  const month = pad(readPart(parts, 'month'))
  const day = pad(readPart(parts, 'day'))
  const hour = pad(readPart(parts, 'hour') % 24)
  const minute = pad(readPart(parts, 'minute'))
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/** Formats a UTC instant for display in a specific IANA timezone. */
export function formatZonedDateTime(
  iso: string,
  timeZone: string,
  locale = 'de-DE',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso))
}
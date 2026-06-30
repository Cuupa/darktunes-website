import { z } from 'zod'
import type { SubmissionFieldType } from '@/lib/submissions/fieldTypes'

const ISRC_REGEX = /^[A-Z]{2}-[A-Z0-9]{3}-\d{2}-\d{5}$/i
const EAN_REGEX = /^\d{13}$/
const DATE_DMY_REGEX = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/
const DURATION_REGEX = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/

export function validateEanChecksum(ean: string): boolean {
  if (!EAN_REGEX.test(ean)) return false
  const digits = ean.split('').map(Number)
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return check === digits[12]
}

export function parseDateDmyToIso(value: string): string | null {
  const match = DATE_DMY_REGEX.exec(value.trim())
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export function parseDurationToSeconds(value: string): number | null {
  const match = DURATION_REGEX.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  return hours * 3600 + minutes * 60 + seconds
}

export function formatSecondsToDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const validators: Record<SubmissionFieldType, z.ZodType<string>> = {
  text: z.string(),
  textarea: z.string(),
  url: z.string().url(),
  email: z.string().email(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_dmy: z.string().refine((v) => parseDateDmyToIso(v) !== null, 'Expected DD/MM/YYYY'),
  number: z.string().refine((v) => !Number.isNaN(Number(v)), 'Expected a number'),
  year: z.string().refine((v) => {
    const y = Number(v)
    return Number.isInteger(y) && y >= 1900 && y <= 2100
  }, 'Expected a year between 1900 and 2100'),
  boolean: z.enum(['true', 'false']),
  select: z.string().min(1),
  ean: z.string().refine(validateEanChecksum, 'Invalid EAN-13'),
  isrc: z.string().regex(ISRC_REGEX, 'Expected CC-XXX-YY-NNNNN'),
  duration: z.string().refine((v) => parseDurationToSeconds(v) !== null, 'Expected HH:MM:SS'),
  seconds: z.string().refine((v) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 0
  }, 'Expected seconds ≥ 0'),
}

export function validateFieldValue(fieldType: SubmissionFieldType, value: string): string | null {
  if (!value.trim() && fieldType !== 'boolean') return null
  const schema = validators[fieldType]
  const result = schema.safeParse(value.trim())
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid value')
}

export function normalizeFieldValue(fieldType: SubmissionFieldType, value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed && fieldType !== 'boolean') return null
  switch (fieldType) {
    case 'boolean':
      return trimmed === 'true'
    case 'number':
    case 'year':
    case 'seconds':
      return Number(trimmed)
    case 'date_dmy': {
      const iso = parseDateDmyToIso(trimmed)
      return iso ?? trimmed
    }
    case 'duration': {
      const secs = parseDurationToSeconds(trimmed)
      return secs ?? trimmed
    }
    case 'isrc':
      return trimmed.toUpperCase()
    default:
      return trimmed
  }
}
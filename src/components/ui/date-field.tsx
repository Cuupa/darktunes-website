'use client'

import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { CalendarBlank } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isValidIsoDate } from '@/lib/sos/accountingInputValidation'
import { cn } from '@/lib/utils'

/** How the controlled `value` / `onChange` string is encoded. */
export type DateFieldStorageFormat = 'yyyy-MM-dd' | 'dd/MM/yyyy'

export interface DateFieldProps {
  id: string
  /**
   * Visible label. Omit or pass empty when the caller renders its own label
   * (then provide `aria-label` for accessibility).
   */
  label?: string
  value: string
  onChange: (value: string) => void
  description?: string
  error?: string
  className?: string
  disabled?: boolean
  required?: boolean
  /** ISO date YYYY-MM-DD — only applied when storage is ISO */
  min?: string
  /** ISO date YYYY-MM-DD — only applied when storage is ISO */
  max?: string
  placeholder?: string
  /**
   * Storage encoding for value/onChange.
   * - `yyyy-MM-dd` (default): DB / API ISO dates
   * - `dd/MM/yyyy`: submission schema `date_dmy` fields
   */
  storageFormat?: DateFieldStorageFormat
  /** Accessible name when `label` is omitted */
  'aria-label'?: string
}

function parseStoredDate(value: string, storageFormat: DateFieldStorageFormat): Date | undefined {
  if (!value?.trim()) return undefined
  const candidates =
    storageFormat === 'dd/MM/yyyy'
      ? ['dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'd.M.yyyy', 'yyyy-MM-dd']
      : ['yyyy-MM-dd', 'dd/MM/yyyy', 'dd.MM.yyyy']
  for (const fmt of candidates) {
    const d = parse(value.trim(), fmt, new Date())
    if (isValid(d)) return d
  }
  // ISO fast-path used by accounting validators
  if (storageFormat === 'yyyy-MM-dd' && isValidIsoDate(value)) {
    const d = parse(value, 'yyyy-MM-dd', new Date())
    return isValid(d) ? d : undefined
  }
  return undefined
}

function parseIsoBound(value: string | undefined): Date | undefined {
  if (!value || !isValidIsoDate(value)) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

/**
 * Accessible date picker using Popover + Calendar.
 * Prefer over native `type="date"` / plain text for consistent UX and validation.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  description,
  error,
  className,
  disabled = false,
  required = false,
  min,
  max,
  placeholder = 'Select date…',
  storageFormat = 'yyyy-MM-dd',
  'aria-label': ariaLabel,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseStoredDate(value, storageFormat)
  const minDate = parseIsoBound(min)
  const maxDate = parseIsoBound(max)
  const showLabel = Boolean(label)

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-start gap-2 font-normal',
              !value && 'text-muted-foreground',
              error && 'border-destructive aria-invalid:border-destructive',
            )}
            aria-label={ariaLabel ?? (showLabel ? undefined : 'Date')}
            aria-required={required}
            aria-invalid={!!error}
            aria-haspopup="dialog"
            aria-describedby={error ? `${id}-error` : description ? `${id}-desc` : undefined}
          >
            <CalendarBlank size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
            {selected ? format(selected, 'dd.MM.yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (!day) return
              onChange(format(day, storageFormat))
              setOpen(false)
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true
              if (maxDate && date > maxDate) return true
              return false
            }}
            defaultMonth={selected ?? minDate ?? maxDate}
          />
        </PopoverContent>
      </Popover>
      {description && !error && (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

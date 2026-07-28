'use client'

import { useState } from 'react'
import { format, parse } from 'date-fns'
import { CalendarBlank } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isValidIsoDate } from '@/lib/sos/accountingInputValidation'
import { cn } from '@/lib/utils'

export interface DateFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  description?: string
  error?: string
  className?: string
  disabled?: boolean
  required?: boolean
  /** ISO date YYYY-MM-DD */
  min?: string
  /** ISO date YYYY-MM-DD */
  max?: string
  placeholder?: string
}

function parseYmd(value: string): Date | undefined {
  if (!isValidIsoDate(value)) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return Number.isNaN(d.getTime()) ? undefined : d
}

/**
 * Accessible date picker (YYYY-MM-DD) using Popover + Calendar.
 * Prefer over native `type="date"` for consistent admin CI and validation.
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
}: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseYmd(value)
  const minDate = min ? parseYmd(min) : undefined
  const maxDate = max ? parseYmd(max) : undefined

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
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
              onChange(format(day, 'yyyy-MM-dd'))
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

'use client'

import { useEffect, useState } from 'react'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { compareYearMonth, isValidYearMonth, parseYearMonth as parseYm } from '@/lib/sos/accountingInputValidation'
import { cn } from '@/lib/utils'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export interface MonthFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Optional helper under the control */
  description?: string
  error?: string
  className?: string
  disabled?: boolean
  required?: boolean
  /** Inclusive minimum YYYY-MM */
  min?: string
  /** Inclusive maximum YYYY-MM */
  max?: string
  placeholder?: string
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function displayLabel(value: string, placeholder: string): string {
  const parsed = parseYm(value)
  if (!parsed) return value || placeholder
  return `${MONTH_LABELS[parsed.month - 1]} ${parsed.year}`
}

function isMonthDisabled(year: number, month: number, min?: string, max?: string): boolean {
  const ym = formatYearMonth(year, month)
  if (min && isValidYearMonth(min)) {
    const c = compareYearMonth(ym, min)
    if (c != null && c < 0) return true
  }
  if (max && isValidYearMonth(max)) {
    const c = compareYearMonth(ym, max)
    if (c != null && c > 0) return true
  }
  return false
}

/**
 * Accessible month picker (YYYY-MM) using Popover + month grid.
 * Prefer over native `type="month"` for consistent admin CI.
 */
export function MonthField({
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
  placeholder = 'Select month…',
}: MonthFieldProps) {
  const [open, setOpen] = useState(false)
  const parsed = parseYm(value)
  const viewYear = parsed?.year ?? new Date().getFullYear()

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
              error && 'border-destructive',
            )}
            aria-haspopup="dialog"
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : description ? `${id}-desc` : undefined}
          >
            <CalendarBlank size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
            {displayLabel(value, placeholder)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <MonthPickerPanel
            year={viewYear}
            selected={parsed}
            min={min}
            max={max}
            onSelect={(year, month) => {
              onChange(formatYearMonth(year, month))
              setOpen(false)
            }}
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

function MonthPickerPanel({
  year: initialYear,
  selected,
  min,
  max,
  onSelect,
}: {
  year: number
  selected: { year: number; month: number } | null
  min?: string
  max?: string
  onSelect: (year: number, month: number) => void
}) {
  const [year, setYear] = useState(initialYear)

  useEffect(() => {
    setYear(initialYear)
  }, [initialYear])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Previous year"
          onClick={() => setYear((y) => y - 1)}
        >
          <CaretLeft size={16} aria-hidden="true" />
        </Button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Next year"
          onClick={() => setYear((y) => y + 1)}
        >
          <CaretRight size={16} aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label="Month">
        {MONTH_LABELS.map((name, index) => {
          const month = index + 1
          const isSelected = selected?.year === year && selected.month === month
          const isDisabled = isMonthDisabled(year, month, min, max)
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={isDisabled}
              className={cn(
                'rounded-md border px-2 py-2 text-sm transition-colors min-h-11',
                isSelected
                  ? 'border-primary bg-primary/15 text-foreground font-medium'
                  : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
                isDisabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
              )}
              onClick={() => {
                if (!isDisabled) onSelect(year, month)
              }}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

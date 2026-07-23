'use client'

import { useEffect, useState } from 'react'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  className?: string
  disabled?: boolean
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function displayLabel(value: string): string {
  const parsed = parseYearMonth(value)
  if (!parsed) return value || 'Select month…'
  return `${MONTH_LABELS[parsed.month - 1]} ${parsed.year}`
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
  className,
  disabled = false,
}: MonthFieldProps) {
  const parsed = parseYearMonth(value)
  const viewYear = parsed?.year ?? new Date().getFullYear()

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-start gap-2 font-normal',
              !value && 'text-muted-foreground',
            )}
            aria-haspopup="dialog"
          >
            <CalendarBlank size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
            {displayLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <MonthPickerPanel
            year={viewYear}
            selected={parsed}
            onSelect={(year, month) => onChange(formatYearMonth(year, month))}
          />
        </PopoverContent>
      </Popover>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function MonthPickerPanel({
  year: initialYear,
  selected,
  onSelect,
}: {
  year: number
  selected: { year: number; month: number } | null
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
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={cn(
                'rounded-md border px-2 py-2 text-sm transition-colors min-h-11',
                isSelected
                  ? 'border-primary bg-primary/15 text-foreground font-medium'
                  : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onSelect(year, month)}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

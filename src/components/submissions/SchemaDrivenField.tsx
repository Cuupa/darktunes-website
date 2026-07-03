'use client'

import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon } from '@phosphor-icons/react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getFieldLabel, getFieldPlaceholder } from '@/lib/submissions/fieldLabels'
import type { SelectOption } from '@/lib/submissions/fieldTypes'
import type { SubmissionFormField } from '@/types'

interface SchemaDrivenFieldProps {
  field: SubmissionFormField
  locale: string
  value: string
  onChange: (value: string) => void
  idPrefix?: string
  error?: string | null
}

function selectOptions(field: SubmissionFormField): SelectOption[] {
  const raw = field.fieldOptions?.options
  if (!Array.isArray(raw)) return []
  return raw as SelectOption[]
}

function optionLabel(option: SelectOption, locale: string): string {
  return option.labels[locale] ?? option.labels.en ?? option.value
}

export function SchemaDrivenField({
  field,
  locale,
  value,
  onChange,
  idPrefix = 'field',
  error,
}: SchemaDrivenFieldProps) {
  const label = getFieldLabel(field, locale)
  const placeholder = getFieldPlaceholder(field, locale)
  const id = `${idPrefix}-${field.fieldKey}`

  const labelEl = (
    <Label htmlFor={id}>
      {label}
      {field.isRequired && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
    </Label>
  )

  if (field.fieldType === 'boolean') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            aria-required={field.isRequired}
          />
          <Label htmlFor={id}>{label}</Label>
        </div>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
    )
  }

  if (field.fieldType === 'select') {
    const options = selectOptions(field)
    return (
      <div className="space-y-2">
        {labelEl}
        <select
          id={id}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
          aria-invalid={!!error}
        >
          {!field.isRequired && <option value="">—</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{optionLabel(opt, locale)}</option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
    )
  }

  if (field.fieldType === 'textarea' || /lyrics/i.test(field.fieldKey)) {
    return (
      <div className="space-y-2">
        {labelEl}
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={field.isRequired}
          aria-invalid={!!error}
          className="min-h-[120px]"
        />
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </div>
    )
  }

  if (field.fieldType === 'date') {
    return (
      <DateField
        id={id}
        labelEl={labelEl}
        value={value}
        onChange={onChange}
        required={field.isRequired}
        error={error ?? null}
        placeholder={placeholder}
      />
    )
  }

  const inputType =
    field.fieldType === 'url' ? 'url'
    : field.fieldType === 'email' ? 'email'
    : field.fieldType === 'number' || field.fieldType === 'year' || field.fieldType === 'seconds'
      ? 'number'
      : 'text'

  return (
    <div className="space-y-2">
      {labelEl}
      <Input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={field.isRequired}
        aria-invalid={!!error}
        min={field.fieldType === 'year' ? 1900 : field.fieldType === 'seconds' ? 0 : undefined}
        max={field.fieldType === 'year' ? 2100 : undefined}
      />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}

/** YYYY-MM-DD string ↔ Date conversion helpers */
function parseYmd(ymd: string): Date | undefined {
  if (!ymd) return undefined
  const d = parse(ymd, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

interface DateFieldProps {
  id: string
  labelEl: React.ReactNode
  value: string
  onChange: (v: string) => void
  required: boolean
  error: string | null
  placeholder: string
}

function DateField({ id, labelEl, value, onChange, required, error, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = parseYmd(value)

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }

  return (
    <div className="space-y-2">
      {labelEl}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground',
              error && 'border-destructive',
            )}
            aria-required={required}
            aria-invalid={!!error}
            aria-haspopup="dialog"
          >
            <CalendarIcon size={16} className="mr-2 shrink-0 opacity-70" />
            {selected ? format(selected, 'dd.MM.yyyy') : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}
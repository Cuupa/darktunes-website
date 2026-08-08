'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateField } from '@/components/ui/date-field'
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

  if (field.fieldType === 'date' || field.fieldType === 'date_dmy') {
    return (
      <DateField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        required={field.isRequired}
        error={error ?? undefined}
        placeholder={placeholder || 'Select date…'}
        /** date_dmy stores day-first strings for schema validation; date stores ISO. */
        storageFormat={field.fieldType === 'date_dmy' ? 'dd/MM/yyyy' : 'yyyy-MM-dd'}
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

'use client'

import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  normalizeDecimalInput,
  parseMoneyAmount,
  parseOptionalPercent,
  parsePositiveInt,
  parseRequiredPercent,
  type AccountingInputError,
} from '@/lib/sos/accountingInputValidation'
import { cn } from '@/lib/utils'

export type FieldMessageMap = Partial<Record<AccountingInputError, string>>

const DEFAULT_MESSAGES: Record<AccountingInputError, string> = {
  required: 'This field is required',
  invalid: 'Enter a valid number',
  out_of_range: 'Value is out of the allowed range',
  too_many_decimals: 'Use at most 2 decimal places',
  period_order: 'End must be on or after start',
  invalid_email: 'Enter a valid email address',
  invalid_iban: 'Enter a valid IBAN',
}

function messageFor(error: AccountingInputError | null, map?: FieldMessageMap): string | undefined {
  if (!error) return undefined
  return map?.[error] ?? DEFAULT_MESSAGES[error]
}

interface BaseFieldProps {
  id?: string
  label: string
  description?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  required?: boolean
  messages?: FieldMessageMap
}

export interface PercentFieldProps extends BaseFieldProps {
  value: number | undefined | null
  onChange: (value: number | undefined) => void
  optional?: boolean
  placeholder?: string
}

/** Controlled 0–100% input with clamp-on-blur and inline error. */
export function PercentField({
  id: idProp,
  label,
  value,
  onChange,
  description,
  className,
  inputClassName,
  disabled,
  required: _required,
  optional = false,
  placeholder = '0',
  messages,
}: PercentFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<AccountingInputError | null>(null)
  const display = draft ?? (value == null || Number.isNaN(value) ? '' : String(value))

  const commit = (raw: string) => {
    const parsed = optional ? parseOptionalPercent(raw) : parseRequiredPercent(raw)
    if (!parsed.ok) {
      setError(parsed.error)
      setDraft(raw)
      return
    }
    setError(null)
    setDraft(null)
    onChange(parsed.value)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : description ? `${id}-desc` : undefined}
        className={cn(error && 'border-destructive', inputClassName)}
        onChange={(e) => {
          const raw = e.target.value
          setDraft(raw)
          if (!raw.trim() && optional) {
            setError(null)
            onChange(undefined)
            return
          }
          const preview = optional ? parseOptionalPercent(raw) : parseRequiredPercent(raw)
          if (preview.ok) {
            setError(null)
            onChange(preview.value)
          } else if (raw.trim()) {
            setError(preview.error)
          }
        }}
        onBlur={() => {
          if (draft == null) return
          commit(draft)
        }}
      />
      {description && !error && (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {messageFor(error, messages)}
        </p>
      )}
    </div>
  )
}

export interface MoneyFieldProps extends Omit<BaseFieldProps, 'label'> {
  label?: string
  value: string
  onChange: (value: string) => void
  onValidChange?: (value: number | null) => void
  allowZero?: boolean
  min?: number
  max?: number
  placeholder?: string
  prefix?: string
}

/** Text money field (EUR). Parent keeps string draft; receives validated number via onValidChange. */
export function MoneyField({
  id: idProp,
  label,
  value,
  onChange,
  onValidChange,
  description,
  className,
  inputClassName,
  disabled,
  required = true,
  allowZero = false,
  min,
  max,
  placeholder = '0.00',
  prefix,
  messages,
}: MoneyFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const parsed = parseMoneyAmount(value, { required, allowZero, min, max })
  // Only show error after non-empty invalid input
  const showError = value.trim().length > 0 && !parsed.ok ? parsed.error : null

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="flex items-center gap-2">
        {prefix ? <span className="text-sm text-muted-foreground shrink-0">{prefix}</span> : null}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!showError}
          aria-label={label || undefined}
          aria-describedby={showError ? `${id}-error` : description ? `${id}-desc` : undefined}
          className={cn(showError && 'border-destructive', inputClassName)}
          onChange={(e) => {
            const raw = e.target.value
            // Allow typing intermediate states
            if (raw === '' || /^-?\d*[.,]?\d{0,4}$/.test(raw.replace(/\s/g, ''))) {
              onChange(raw)
              const next = parseMoneyAmount(raw, { required, allowZero, min, max })
              onValidChange?.(next.ok ? next.value : null)
            }
          }}
          onBlur={() => {
            if (!value.trim()) {
              onValidChange?.(null)
              return
            }
            const next = parseMoneyAmount(normalizeDecimalInput(value), { required, allowZero, min, max })
            if (next.ok) {
              onChange(next.value.toFixed(2))
              onValidChange?.(next.value)
            }
          }}
        />
      </div>
      {description && !showError && (
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {showError && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {messageFor(showError, messages)}
        </p>
      )}
    </div>
  )
}

export interface IntegerFieldProps extends BaseFieldProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  placeholder?: string
}

export function IntegerField({
  id: idProp,
  label,
  value,
  onChange,
  description,
  className,
  inputClassName,
  disabled,
  min = 1,
  max = 365,
  placeholder,
  messages,
}: IntegerFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<AccountingInputError | null>(null)
  const display = draft ?? String(value)

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={cn(error && 'border-destructive', inputClassName)}
        onChange={(e) => {
          const raw = e.target.value
          if (raw !== '' && !/^\d*$/.test(raw)) return
          setDraft(raw)
          const parsed = parsePositiveInt(raw, { min, max })
          if (parsed.ok) {
            setError(null)
            onChange(parsed.value)
          } else if (raw) {
            setError(parsed.error)
          }
        }}
        onBlur={() => {
          if (draft == null) return
          const parsed = parsePositiveInt(draft, { min, max })
          if (parsed.ok) {
            setError(null)
            setDraft(null)
            onChange(parsed.value)
          } else {
            setError(parsed.error)
            setDraft(String(value))
            setTimeout(() => setDraft(null), 0)
          }
        }}
      />
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {messageFor(error, messages)}
        </p>
      )}
    </div>
  )
}

export function isMoneyInputValid(
  raw: string,
  options?: { required?: boolean; allowZero?: boolean; min?: number; max?: number },
): boolean {
  return parseMoneyAmount(raw, options).ok
}

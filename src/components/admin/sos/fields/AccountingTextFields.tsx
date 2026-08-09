'use client'

import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatIbanDisplay, isValidEmail, parseRequiredEmail } from '@/lib/sos/accountingInputValidation'
import { isValidIBAN, sanitiseIBAN } from '@/lib/sos/iban-validator'
import { cn } from '@/lib/utils'

interface BaseProps {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  description?: string
  className?: string
  inputClassName?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
  errorMessage?: string
}

export function EmailField({
  id: idProp,
  label,
  value,
  onChange,
  description,
  className,
  inputClassName,
  disabled,
  required = false,
  placeholder,
  errorMessage = 'Enter a valid email address',
}: BaseProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [touched, setTouched] = useState(false)
  const invalid =
    touched &&
    (required
      ? !parseRequiredEmail(value).ok
      : value.trim().length > 0 && !isValidEmail(value))

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={cn(invalid && 'border-destructive', inputClassName)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
      />
      {description && !invalid && <p className="text-xs text-muted-foreground">{description}</p>}
      {invalid && (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export function IbanField({
  id: idProp,
  label,
  value,
  onChange,
  description,
  className,
  inputClassName,
  disabled,
  required = false,
  placeholder,
  errorMessage = 'Enter a valid IBAN',
}: BaseProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [touched, setTouched] = useState(false)
  /** Parent may store spaced or raw IBAN — always show grouped display. */
  const display = formatIbanDisplay(value)
  const cleaned = sanitiseIBAN(value)
  const invalid =
    touched &&
    ((required && !cleaned) || (cleaned.length > 0 && !isValidIBAN(cleaned)))

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={cn('font-mono text-sm', invalid && 'border-destructive', inputClassName)}
        onChange={(e) => {
          // Persist sanitised (no spaces) so SEPA/export never see spaced IBANs.
          onChange(sanitiseIBAN(e.target.value))
        }}
        onBlur={() => {
          setTouched(true)
          if (value.trim()) onChange(sanitiseIBAN(value))
        }}
      />
      {description && !invalid && <p className="text-xs text-muted-foreground">{description}</p>}
      {invalid && (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export function RequiredTextField({
  id: idProp,
  label,
  value,
  onChange,
  description,
  className,
  inputClassName,
  disabled,
  required = true,
  placeholder,
  maxLength = 500,
  errorMessage = 'This field is required',
}: BaseProps & { maxLength?: number }) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [touched, setTouched] = useState(false)
  const invalid = touched && required && !value.trim()

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid}
        className={cn(invalid && 'border-destructive', inputClassName)}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        onBlur={() => setTouched(true)}
      />
      {description && !invalid && <p className="text-xs text-muted-foreground">{description}</p>}
      {invalid && (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

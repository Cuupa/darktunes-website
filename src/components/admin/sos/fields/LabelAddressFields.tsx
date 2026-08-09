'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { MapPin } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COUNTRIES } from '@/lib/countries'
import {
  composeLabelAddress,
  parseLabelAddress,
  type LabelAddressParts,
} from '@/lib/sos/labelAddress'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { interpolate } from '@/lib/i18n/interpolate'
import { cn } from '@/lib/utils'

export interface LabelAddressFieldsProps {
  /** Multi-line or comma-separated LabelInfo.address */
  value: string
  onChange: (composedAddress: string) => void
  idPrefix?: string
  className?: string
  disabled?: boolean
  required?: boolean
  showHeading?: boolean
}

/**
 * Normalized label address form: street, house number, postal code, city, country.
 * Persists as multi-line text on LabelInfo.address for PDF compatibility.
 */
export function LabelAddressFields({
  value,
  onChange,
  idPrefix,
  className,
  disabled = false,
  required = false,
  showHeading = true,
}: LabelAddressFieldsProps) {
  const t = useAccountingLabels()
  const autoId = useId()
  const prefix = idPrefix ?? autoId
  const [parts, setParts] = useState<LabelAddressParts>(() => parseLabelAddress(value))
  const localEditRef = useRef(false)

  useEffect(() => {
    if (localEditRef.current) {
      localEditRef.current = false
      return
    }
    setParts(parseLabelAddress(value))
  }, [value])

  const patch = (next: Partial<LabelAddressParts>) => {
    const merged = { ...parts, ...next }
    setParts(merged)
    localEditRef.current = true
    onChange(composeLabelAddress(merged))
  }

  // Country may be free-text name (legacy) or ISO code
  const countrySelectValue = (() => {
    const raw = parts.country.trim()
    if (!raw) return ''
    const byCode = COUNTRIES.find((c) => c.code.toUpperCase() === raw.toUpperCase())
    if (byCode) return byCode.code
    const byName = COUNTRIES.find((c) => c.name.toLowerCase() === raw.toLowerCase())
    return byName?.code ?? raw
  })()

  const knownCountry = COUNTRIES.some((c) => c.code === countrySelectValue)

  return (
    <div className={cn('space-y-3 rounded-md border border-border/60 bg-muted/10 p-4', className)}>
      {showHeading && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <MapPin size={14} aria-hidden="true" />
          {t.setupAddressHeading}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-street`}>
            {t.setupStreet}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id={`${prefix}-street`}
            value={parts.street}
            disabled={disabled}
            onChange={(e) => patch({ street: e.target.value.slice(0, 200) })}
            placeholder={t.setupStreetNamePlaceholder}
            autoComplete="address-line1"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-house`}>
            {t.setupHouseNumber}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id={`${prefix}-house`}
            value={parts.houseNumber}
            disabled={disabled}
            onChange={(e) =>
              patch({ houseNumber: e.target.value.replace(/[^\d\w\s\-/]/gi, '').slice(0, 16) })
            }
            placeholder={t.setupHouseNumberPlaceholder}
            autoComplete="address-line2"
            maxLength={16}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-postal`}>
            {t.setupPostalCode}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id={`${prefix}-postal`}
            value={parts.postalCode}
            disabled={disabled}
            onChange={(e) =>
              patch({ postalCode: e.target.value.replace(/[^\dA-Za-z\s-]/g, '').slice(0, 12) })
            }
            placeholder="69118"
            autoComplete="postal-code"
            maxLength={12}
            inputMode="numeric"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${prefix}-city`}>
            {t.setupCity}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Input
            id={`${prefix}-city`}
            value={parts.city}
            disabled={disabled}
            onChange={(e) => patch({ city: e.target.value.slice(0, 100) })}
            placeholder="Heidelberg"
            autoComplete="address-level2"
            maxLength={100}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}-country`}>
          {t.setupCountry}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Select
          // Radix forbids value=""; use undefined for placeholder state.
          value={knownCountry && countrySelectValue ? countrySelectValue : undefined}
          disabled={disabled}
          onValueChange={(code) => {
            const match = COUNTRIES.find((c) => c.code === code)
            patch({ country: match?.name ?? code })
          }}
        >
          <SelectTrigger id={`${prefix}-country`} className="w-full">
            <SelectValue placeholder={t.setupCountryPlaceholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!knownCountry && parts.country.trim() && (
          <p className="text-xs text-muted-foreground">
            {interpolate(t.setupCountryLegacyHint, { country: parts.country })}
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Buildings, CalendarBlank, Coins, MapPin, Percent } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { MonthField } from '@/components/ui/month-field'
import type { AppDefaults, LabelInfo } from '@/lib/sos/types'

interface SosSetupWizardStepProps {
  periodStart: string
  periodEnd: string
  onPeriodStartChange: (value: string) => void
  onPeriodEndChange: (value: string) => void
  appDefaults: AppDefaults
  onAppDefaultsChange: (value: AppDefaults) => void
  labelInfo: LabelInfo
  onLabelInfoChange: (value: LabelInfo) => void
  onLoadPreset?: () => void
  presetLoading?: boolean
}

interface AddressParts {
  street: string
  postalCode: string
  city: string
  country: string
}

function parseAddress(address: string): AddressParts {
  const lines = address
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { street: '', postalCode: '', city: '', country: '' }
  }

  if (lines.length === 1) {
    return { street: lines[0] ?? '', postalCode: '', city: '', country: '' }
  }

  // Prefer "PLZ City" on second line
  const street = lines[0] ?? ''
  const line2 = lines[1] ?? ''
  const postalMatch = /^(\d{4,5})\s+(.+)$/.exec(line2)
  if (postalMatch) {
    return {
      street,
      postalCode: postalMatch[1] ?? '',
      city: postalMatch[2] ?? '',
      country: lines[2] ?? '',
    }
  }

  return {
    street,
    postalCode: '',
    city: line2,
    country: lines[2] ?? '',
  }
}

function composeAddress(parts: AddressParts): string {
  const line2 = [parts.postalCode, parts.city].filter(Boolean).join(' ').trim()
  return [parts.street, line2, parts.country].filter(Boolean).join('\n')
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
        <Icon size={18} weight="bold" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

export function SosSetupWizardStep({
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  appDefaults,
  onAppDefaultsChange,
  labelInfo,
  onLabelInfoChange,
  onLoadPreset,
  presetLoading = false,
}: SosSetupWizardStepProps) {
  const initialParts = parseAddress(labelInfo.address ?? '')
  const [street, setStreet] = useState(initialParts.street)
  const [postalCode, setPostalCode] = useState(initialParts.postalCode)
  const [city, setCity] = useState(initialParts.city)
  const [country, setCountry] = useState(initialParts.country)
  /** Skip re-parse when the address change came from our own field edits. */
  const localAddressEditRef = useRef(false)

  useEffect(() => {
    if (localAddressEditRef.current) {
      localAddressEditRef.current = false
      return
    }
    const parts = parseAddress(labelInfo.address ?? '')
    setStreet(parts.street)
    setPostalCode(parts.postalCode)
    setCity(parts.city)
    setCountry(parts.country)
  }, [labelInfo.address])

  const patchAddress = (next: Partial<AddressParts>) => {
    const parts: AddressParts = {
      street: next.street ?? street,
      postalCode: next.postalCode ?? postalCode,
      city: next.city ?? city,
      country: next.country ?? country,
    }
    if (next.street !== undefined) setStreet(next.street)
    if (next.postalCode !== undefined) setPostalCode(next.postalCode)
    if (next.city !== undefined) setCity(next.city)
    if (next.country !== undefined) setCountry(next.country)
    localAddressEditRef.current = true
    onLabelInfoChange({ ...labelInfo, address: composeAddress(parts) })
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold mb-1">Set up accounting period</h2>
        <p className="text-sm text-muted-foreground">
          Enter the settlement period and label defaults used on PDFs. Advanced rules stay available in Advanced mode.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={CalendarBlank}
            title="Settlement period"
            description="Month range for this import and statement run"
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <MonthField
            id="sos-setup-period-start"
            label="Period from"
            value={periodStart}
            onChange={onPeriodStartChange}
            description="First month included (YYYY-MM)"
          />
          <MonthField
            id="sos-setup-period-end"
            label="Period to"
            value={periodEnd}
            onChange={onPeriodEndChange}
            description="Last month included (YYYY-MM)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={Percent}
            title="Split & distribution fees"
            description="Defaults applied when an artist has no individual rates"
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="sos-setup-split">Default split %</Label>
            <Input
              id="sos-setup-split"
              type="number"
              min={0}
              max={100}
              value={appDefaults.defaultSplitPercentage}
              onChange={(e) =>
                onAppDefaultsChange({
                  ...appDefaults,
                  defaultSplitPercentage: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sos-setup-fee-digital">Digital fee %</Label>
            <Input
              id="sos-setup-fee-digital"
              type="number"
              min={0}
              max={100}
              value={appDefaults.distributionFeeDigital ?? appDefaults.distributionFeePercentage}
              onChange={(e) =>
                onAppDefaultsChange({
                  ...appDefaults,
                  distributionFeeDigital: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sos-setup-fee-physical">Physical fee %</Label>
            <Input
              id="sos-setup-fee-physical"
              type="number"
              min={0}
              max={100}
              value={appDefaults.distributionFeePhysical ?? appDefaults.distributionFeePercentage}
              onChange={(e) =>
                onAppDefaultsChange({
                  ...appDefaults,
                  distributionFeePhysical: Number(e.target.value),
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={Buildings}
            title="Label identity (PDF)"
            description="Shown on statements and payout documents"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sos-setup-label-name">Label name</Label>
            <Input
              id="sos-setup-label-name"
              value={labelInfo.name}
              onChange={(e) => onLabelInfoChange({ ...labelInfo, name: e.target.value })}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <MapPin size={14} aria-hidden="true" />
              Address
            </div>
            <div className="space-y-2">
              <Label htmlFor="sos-setup-street">Street &amp; number</Label>
              <Input
                id="sos-setup-street"
                value={street}
                onChange={(e) => patchAddress({ street: e.target.value })}
                placeholder="Musterstraße 1"
                autoComplete="street-address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sos-setup-postal">Postal code</Label>
                <Input
                  id="sos-setup-postal"
                  value={postalCode}
                  onChange={(e) => patchAddress({ postalCode: e.target.value })}
                  placeholder="10115"
                  autoComplete="postal-code"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sos-setup-city">City</Label>
                <Input
                  id="sos-setup-city"
                  value={city}
                  onChange={(e) => patchAddress({ city: e.target.value })}
                  placeholder="Berlin"
                  autoComplete="address-level2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sos-setup-country">Country</Label>
              <Input
                id="sos-setup-country"
                value={country}
                onChange={(e) => patchAddress({ country: e.target.value })}
                placeholder="Germany"
                autoComplete="country-name"
              />
            </div>
          </div>

          <details className="group rounded-md border border-border/60">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coins size={15} className="text-primary" aria-hidden="true" />
                Legal &amp; bank (optional)
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
              <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
            </summary>
            <div className="border-t border-border/60 p-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sos-setup-tax-id">VAT ID</Label>
                <Input
                  id="sos-setup-tax-id"
                  value={labelInfo.taxId ?? ''}
                  onChange={(e) => onLabelInfoChange({ ...labelInfo, taxId: e.target.value || undefined })}
                  placeholder="DE123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sos-setup-tax-number">Tax number</Label>
                <Input
                  id="sos-setup-tax-number"
                  value={labelInfo.taxNumber ?? ''}
                  onChange={(e) => onLabelInfoChange({ ...labelInfo, taxNumber: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sos-setup-legal">Legal form / managing director</Label>
                <Input
                  id="sos-setup-legal"
                  value={labelInfo.legalForm ?? ''}
                  onChange={(e) => onLabelInfoChange({ ...labelInfo, legalForm: e.target.value || undefined })}
                  placeholder="GmbH · Geschäftsführer: …"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sos-setup-email">Contact email</Label>
                <Input
                  id="sos-setup-email"
                  type="email"
                  value={labelInfo.email ?? ''}
                  onChange={(e) => onLabelInfoChange({ ...labelInfo, email: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sos-setup-iban">SEPA IBAN</Label>
                <Input
                  id="sos-setup-iban"
                  value={labelInfo.sepaIban ?? ''}
                  onChange={(e) => onLabelInfoChange({ ...labelInfo, sepaIban: e.target.value || undefined })}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {onLoadPreset && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={presetLoading} onClick={onLoadPreset}>
            {presetLoading ? 'Loading preset…' : 'Load saved preset'}
          </Button>
          <CardDescription className="text-xs m-0">
            Loads workspace defaults from the server for this period.
          </CardDescription>
        </div>
      )}
    </div>
  )
}

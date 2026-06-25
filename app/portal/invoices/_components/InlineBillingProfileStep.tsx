'use client'

import { useState } from 'react'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  isBillingProfileComplete,
  type ArtistBillingProfile,
} from '@/lib/api/artistBillingProfiles'
import type { Dictionary } from '@/i18n/types'

interface InlineBillingProfileStepProps {
  artistId: string
  billingProfile: ArtistBillingProfile | null
  dict: Dictionary['portal']
  onComplete: (profile: ArtistBillingProfile) => void
}

export function InlineBillingProfileStep({
  artistId,
  billingProfile,
  dict,
  onComplete,
}: InlineBillingProfileStepProps) {
  const [form, setForm] = useState({
    legalName: billingProfile?.legalName ?? '',
    street: billingProfile?.street ?? '',
    postalCode: billingProfile?.postalCode ?? '',
    city: billingProfile?.city ?? '',
    country: billingProfile?.country ?? 'DE',
    taxNumber: billingProfile?.taxNumber ?? '',
    vatId: billingProfile?.vatId ?? '',
    isSmallBusiness: billingProfile?.isSmallBusiness ?? false,
  })
  const [saving, setSaving] = useState(false)

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error(dict.profile_error)

      const response = await fetch('/api/portal/billing-profile', {
        method: 'POST',
        headers: {
          Authorization: ['Bearer', session.access_token].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          legal_name: form.legalName,
          street: form.street,
          postal_code: form.postalCode,
          city: form.city,
          country: form.country,
          tax_number: form.taxNumber,
          vat_id: form.vatId,
          is_small_business: form.isSmallBusiness,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { error?: string; profile?: ArtistBillingProfile }
        | null

      if (!response.ok || !json?.profile) {
        throw new Error(json?.error ?? dict.billing_error)
      }

      if (!isBillingProfileComplete(json.profile)) {
        toast.error(dict.invoice_billing_incomplete)
        return
      }

      toast.success(dict.billing_saved)
      onComplete(json.profile)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.billing_error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <WarningCircle size={18} className="text-amber-300" aria-hidden="true" />
          {dict.invoice_billing_inline_title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{dict.invoice_billing_inline_desc}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="inline-billing-legal-name">{dict.billing_legal_name}</Label>
              <Input
                id="inline-billing-legal-name"
                required
                value={form.legalName}
                onChange={(event) => updateField('legalName', event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="inline-billing-street">{dict.billing_street}</Label>
              <Input
                id="inline-billing-street"
                required
                value={form.street}
                onChange={(event) => updateField('street', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-billing-postal">{dict.billing_postal_code}</Label>
              <Input
                id="inline-billing-postal"
                required
                value={form.postalCode}
                onChange={(event) => updateField('postalCode', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-billing-city">{dict.billing_city}</Label>
              <Input
                id="inline-billing-city"
                required
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-billing-country">{dict.billing_country}</Label>
              <Input
                id="inline-billing-country"
                required
                value={form.country}
                onChange={(event) => updateField('country', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline-billing-tax">{dict.billing_tax_number}</Label>
              <Input
                id="inline-billing-tax"
                value={form.taxNumber}
                onChange={(event) => updateField('taxNumber', event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="inline-billing-vat">{dict.billing_vat_id}</Label>
              <Input
                id="inline-billing-vat"
                value={form.vatId}
                onChange={(event) => updateField('vatId', event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isSmallBusiness}
              onCheckedChange={(checked) => updateField('isSmallBusiness', checked === true)}
            />
            <span>{dict.billing_small_business}</span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">{dict.billing_completeness_hint}</p>
            <Button type="submit" disabled={saving || !artistId} className="gap-2">
              <CheckCircle size={16} aria-hidden="true" />
              {saving ? dict.billing_save : dict.invoice_billing_continue}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
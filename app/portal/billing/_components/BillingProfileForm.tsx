'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { ArtistBillingProfile } from '@/lib/api/artistBillingProfiles'

interface BillingProfileFormProps {
  artistId: string
  billingProfile: ArtistBillingProfile | null
  isComplete: boolean
}

export function BillingProfileForm({ artistId, billingProfile, isComplete }: BillingProfileFormProps) {
  const t = useTranslations('portal')

  const [form, setForm] = useState({
    legalName: billingProfile?.legalName ?? '',
    street: billingProfile?.street ?? '',
    postalCode: billingProfile?.postalCode ?? '',
    city: billingProfile?.city ?? '',
    country: billingProfile?.country ?? 'DE',
    taxNumber: billingProfile?.taxNumber ?? '',
    vatId: billingProfile?.vatId ?? '',
    isSmallBusiness: billingProfile?.isSmallBusiness ?? false,
    iban: billingProfile?.iban ?? '',
    bic: billingProfile?.bic ?? '',
    paypalEmail: billingProfile?.paypalEmail ?? '',
  })
  const [complete, setComplete] = useState(isComplete)
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

      if (!session) throw new Error(t('profile_error'))

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
          iban: form.iban,
          bic: form.bic,
          paypal_email: form.paypalEmail,
        }),
      })

      const json = (await response.json().catch(() => null)) as { error?: string; isComplete?: boolean } | null
      if (!response.ok) {
        throw new Error(json?.error ?? t('billing_error'))
      }

      setComplete(Boolean(json?.isComplete))
      toast.success(t('billing_saved'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('billing_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('billing_heading')}</h1>
          <p className="text-sm text-muted-foreground">{t('billing_completeness_hint')}</p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
            complete
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-200',
          )}
        >
          {complete ? <CheckCircle size={16} aria-hidden="true" /> : <WarningCircle size={16} aria-hidden="true" />}
          {complete ? t('billing_complete') : t('billing_incomplete')}
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>{t('billing_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing-legal-name">{t('billing_legal_name')}</Label>
                <Input id="billing-legal-name" required value={form.legalName} onChange={(event) => updateField('legalName', event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing-street">{t('billing_street')}</Label>
                <Input id="billing-street" required value={form.street} onChange={(event) => updateField('street', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-postal-code">{t('billing_postal_code')}</Label>
                <Input id="billing-postal-code" required value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-city">{t('billing_city')}</Label>
                <Input id="billing-city" required value={form.city} onChange={(event) => updateField('city', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-country">{t('billing_country')}</Label>
                <Input id="billing-country" required value={form.country} onChange={(event) => updateField('country', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-tax-number">{t('billing_tax_number')}</Label>
                <Input id="billing-tax-number" value={form.taxNumber} onChange={(event) => updateField('taxNumber', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-vat-id">{t('billing_vat_id')}</Label>
                <Input id="billing-vat-id" value={form.vatId} onChange={(event) => updateField('vatId', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-iban">{t('billing_iban')}</Label>
                <Input id="billing-iban" value={form.iban} onChange={(event) => updateField('iban', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-bic">{t('billing_bic')}</Label>
                <Input id="billing-bic" value={form.bic} onChange={(event) => updateField('bic', event.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billing-paypal-email">{t('billing_paypal')}</Label>
                <Input id="billing-paypal-email" type="email" value={form.paypalEmail} onChange={(event) => updateField('paypalEmail', event.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Checkbox
                id="billing-small-business"
                checked={form.isSmallBusiness}
                onCheckedChange={(checked) => updateField('isSmallBusiness', checked === true)}
              />
              <Label className="cursor-pointer text-sm leading-6" htmlFor="billing-small-business">
                {t('billing_small_business')}
              </Label>
            </div>

            <div className="flex justify-end">
              <Button disabled={saving || !artistId} type="submit">
                {saving ? t('profile_saving') : t('billing_save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

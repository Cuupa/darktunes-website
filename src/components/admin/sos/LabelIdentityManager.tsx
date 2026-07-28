'use client'

/**
 * Structured label identity form for Accounting (PDF branding + SEPA).
 * All fields in normal form — no free-text multi-line address.
 */

import { Buildings, Coins } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LabelInfo } from '@/lib/sos/types'
import { LabelAddressFields } from '@/components/admin/sos/fields/LabelAddressFields'
import { EmailField, IbanField } from '@/components/admin/sos/fields/AccountingTextFields'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { DEFAULT_LABEL_INFO } from '@/lib/sos/defaults'

export interface LabelIdentityManagerProps {
  labelInfo: LabelInfo | Partial<LabelInfo>
  onUpdate: (next: LabelInfo) => void
  /** Compact layout without outer page title (e.g. inside Rules tab). */
  embedded?: boolean
}

function mergeLabel(partial: Partial<LabelInfo>, patch: Partial<LabelInfo>): LabelInfo {
  const sepaRaw = patch.sepaIban !== undefined ? patch.sepaIban : partial.sepaIban
  return {
    ...DEFAULT_LABEL_INFO,
    ...partial,
    ...patch,
    name: (patch.name ?? partial.name ?? DEFAULT_LABEL_INFO.name).trim() || DEFAULT_LABEL_INFO.name,
    address: patch.address ?? partial.address ?? DEFAULT_LABEL_INFO.address,
    sepaIban: sepaRaw ? sepaRaw.replace(/[\s-]/g, '').toUpperCase() : sepaRaw,
  }
}

export function LabelIdentityManager({
  labelInfo,
  onUpdate,
  embedded = false,
}: LabelIdentityManagerProps) {
  const t = useAccountingLabels()
  const patch = (partial: Partial<LabelInfo>) => onUpdate(mergeLabel(labelInfo, partial))

  const body = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label-identity-name">{t.setupLabelName}</Label>
        <Input
          id="label-identity-name"
          value={labelInfo.name ?? ''}
          maxLength={200}
          onChange={(e) => patch({ name: e.target.value.slice(0, 200) })}
          autoComplete="organization"
        />
      </div>

      <LabelAddressFields
        idPrefix="label-identity"
        value={labelInfo.address ?? ''}
        onChange={(address) => patch({ address })}
        required
      />

      <div className="space-y-4 rounded-md border border-border/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Coins size={14} aria-hidden="true" />
          {t.setupLegalHeading}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="label-identity-tax-id">{t.setupVatId}</Label>
            <Input
              id="label-identity-tax-id"
              value={labelInfo.taxId ?? ''}
              onChange={(e) =>
                patch({
                  taxId: e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 20) || undefined,
                })
              }
              placeholder="DE123456789"
              maxLength={20}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label-identity-tax-number">{t.setupTaxNumber}</Label>
            <Input
              id="label-identity-tax-number"
              value={labelInfo.taxNumber ?? ''}
              onChange={(e) => patch({ taxNumber: e.target.value.slice(0, 40) || undefined })}
              maxLength={40}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="label-identity-legal">{t.setupLegalForm}</Label>
            <Input
              id="label-identity-legal"
              value={labelInfo.legalForm ?? ''}
              onChange={(e) => patch({ legalForm: e.target.value.slice(0, 200) || undefined })}
              placeholder={t.setupLegalFormPlaceholder}
              maxLength={200}
            />
          </div>
          <EmailField
            id="label-identity-email"
            label={t.setupContactEmail}
            value={labelInfo.email ?? ''}
            onChange={(v) => patch({ email: v || undefined })}
            errorMessage={t.validationInvalidEmail}
          />
          <div className="space-y-2">
            <Label htmlFor="label-identity-sepa-holder">{t.setupSepaHolder}</Label>
            <Input
              id="label-identity-sepa-holder"
              value={labelInfo.sepaAccountHolder ?? ''}
              onChange={(e) =>
                patch({ sepaAccountHolder: e.target.value.slice(0, 140) || undefined })
              }
              placeholder={t.setupSepaHolderPlaceholder}
              maxLength={140}
            />
          </div>
          <IbanField
            id="label-identity-iban"
            label={t.setupSepaIban}
            value={labelInfo.sepaIban ?? ''}
            onChange={(v) => patch({ sepaIban: v || undefined })}
            errorMessage={t.validationInvalidIban}
            className="sm:col-span-2"
          />
        </div>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Buildings size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">{t.setupLabelTitle}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t.setupLabelDesc}</p>
        <Card className="p-6">{body}</Card>
      </div>
    )
  }

  return body
}

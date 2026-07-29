'use client'

/**
 * src/components/admin/sos/DefaultSettingsManager.tsx
 *
 * UI for editing AppDefaults: default split rates, distribution fees,
 * per-source split overrides, invoice deadline, and finance contact.
 */

import { SlidersHorizontal, EnvelopeSimple, CalendarBlank, Coins, Percent, ArrowClockwise, Database } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { AppDefaults } from '@/lib/sos/types'
import { PercentField, IntegerField } from '@/components/admin/sos/fields/AccountingNumberFields'
import { EmailField } from '@/components/admin/sos/fields/AccountingTextFields'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

interface DefaultSettingsManagerProps {
  defaults: AppDefaults
  onUpdate: (next: AppDefaults) => void
  onApplyDefaultSplitToAll?: () => void
}

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border/40">
      <Icon size={15} weight="bold" className="text-primary shrink-0" />
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
    </div>
  )
}

export function DefaultSettingsManager({ defaults, onUpdate, onApplyDefaultSplitToAll }: DefaultSettingsManagerProps) {
  const t = useAccountingLabels()
  const patch = (partial: Partial<AppDefaults>) => onUpdate({ ...defaults, ...partial })
  const percentMessages = {
    out_of_range: t.validationPercentRange,
    invalid: t.validationFieldInvalidNumber,
    required: t.validationFieldRequired,
  }
  const daysMessages = {
    out_of_range: t.validationDaysRange,
    invalid: t.validationFieldInvalidNumber,
    required: t.validationFieldRequired,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Default Settings</h3>
      </div>

      <Card className="p-6 space-y-8">
        <div className="space-y-4">
          <SectionHeading icon={Coins} title="Payout Default" />

          <PercentField
            id="default-split"
            label="Default Split Rate (%)"
            value={defaults.defaultSplitPercentage}
            onChange={(v) => patch({ defaultSplitPercentage: v ?? 0 })}
            description="Used for new artists when no individual split rate has been set."
            className="max-w-xs"
            messages={percentMessages}
          />
          {onApplyDefaultSplitToAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onApplyDefaultSplitToAll}
              className="mt-1 gap-1.5"
            >
              <ArrowClockwise size={14} />
              Apply default split to all artists
            </Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PercentField
              id="default-split-digital"
              label="Digital Split (%) – optional"
              value={defaults.defaultSplitPercentageDigital}
              onChange={(v) => patch({ defaultSplitPercentageDigital: v })}
              optional
              placeholder="Empty = global rate"
              description="Overrides global split for streaming revenue."
              messages={percentMessages}
            />
            <PercentField
              id="default-split-physical"
              label="Physical/Merch Split (%) – optional"
              value={defaults.defaultSplitPercentagePhysical}
              onChange={(v) => patch({ defaultSplitPercentagePhysical: v })}
              optional
              placeholder="Empty = global rate"
              description="Overrides global split for physical / merch revenue."
              messages={percentMessages}
            />
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading icon={Percent} title="Label Distribution Fee" />

          <PercentField
            id="distribution-fee"
            label="Global Distribution Fee (%)"
            value={defaults.distributionFeePercentage ?? 0}
            onChange={(v) => patch({ distributionFeePercentage: v ?? 0 })}
            description="Retained from each artist's revenue before the split rate is applied. 0% = no fee."
            className="max-w-xs"
            messages={percentMessages}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PercentField
              id="distribution-fee-digital"
              label="Digital Fee (%) – optional"
              value={defaults.distributionFeeDigital}
              onChange={(v) => patch({ distributionFeeDigital: v })}
              optional
              placeholder="Empty = global rate"
              description="Overrides global rate for streaming."
              messages={percentMessages}
            />
            <PercentField
              id="distribution-fee-physical"
              label="Physical/Merch Fee (%) – optional"
              value={defaults.distributionFeePhysical}
              onChange={(v) => patch({ distributionFeePhysical: v })}
              optional
              placeholder="Empty = global rate"
              description="Overrides global rate for physical / merch."
              messages={percentMessages}
            />
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading icon={Database} title="Global Source Split Rates" />
          <p className="text-xs text-muted-foreground">
            Per-data-source default splits applied to ALL artists when no artist-specific rule exists.
            Overrides the global split rate for that source only.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                { id: 'source-believe', key: 'believe', label: 'Believe (Digital / Streaming)' },
                { id: 'source-bandcamp', key: 'bandcamp', label: 'Bandcamp' },
                { id: 'source-darkmerch', key: 'darkmerch', label: 'Darkmerch / Merchandise' },
                { id: 'source-physical', key: 'physical', label: 'Physical (Shopify / Printful)' },
              ] as const
            ).map(({ id, key, label }) => (
              <PercentField
                key={key}
                id={id}
                label={`${label} (%) – optional`}
                value={defaults.sourceSplits?.[key]}
                onChange={(v) =>
                  patch({ sourceSplits: { ...defaults.sourceSplits, [key]: v } })
                }
                optional
                placeholder="Empty = global rate"
                messages={percentMessages}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading icon={CalendarBlank} title="Invoice Deadline" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntegerField
              id="deadline-days"
              label="Payment Deadline (days)"
              value={defaults.invoiceDeadlineDays}
              onChange={(v) => patch({ invoiceDeadlineDays: v })}
              min={1}
              max={365}
              placeholder="e.g. 25"
              description="Days after statement delivery within which artists must submit their invoice."
              messages={daysMessages}
            />

            <div className="space-y-2">
              {/* Free text on purpose: used as email template placeholder (e.g. "20 December"), not ISO date. */}
              <Label htmlFor="deadline-date">Specific due date (optional)</Label>
              <Input
                id="deadline-date"
                type="text"
                value={defaults.invoiceDeadlineDate}
                maxLength={80}
                onChange={(e) => patch({ invoiceDeadlineDate: e.target.value.slice(0, 80) })}
                placeholder="e.g. 20 December"
              />
              <p className="text-xs text-muted-foreground">
                Used in the email template as {'{deadline_date}'}.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="donation-org">Organisation for unclaimed royalties</Label>
            <Input
              id="donation-org"
              type="text"
              value={defaults.royaltyDonationOrg}
              maxLength={200}
              onChange={(e) => patch({ royaltyDonationOrg: e.target.value.slice(0, 200) })}
              placeholder="e.g. Animal Shelter"
            />
            <p className="text-xs text-muted-foreground">
              Non-profit organisation to which unclaimed royalties will be donated.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeading icon={EnvelopeSimple} title="Invoice Receipt" />
          <EmailField
            id="finance-email"
            label="Finance Email"
            value={defaults.financeEmail}
            onChange={(v) => patch({ financeEmail: v })}
            placeholder="e.g. finance@label.com"
            description="Artists send their invoice to this address. Used as {invoice_email} in templates."
            errorMessage={t.validationInvalidEmail}
          />
        </div>
      </Card>
    </div>
  )
}

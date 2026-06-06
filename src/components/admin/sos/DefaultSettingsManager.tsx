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

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function DefaultSettingsManager({ defaults, onUpdate, onApplyDefaultSplitToAll }: DefaultSettingsManagerProps) {
  const patch = (partial: Partial<AppDefaults>) => onUpdate({ ...defaults, ...partial })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Default Settings</h3>
      </div>

      <Card className="p-6 space-y-8">

        {/* ── Split Rate ─────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeading icon={Coins} title="Payout Default" />

          <div className="space-y-2">
            <Label htmlFor="default-split">Default Split Rate (%)</Label>
            <Input
              id="default-split"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={defaults.defaultSplitPercentage}
              onChange={e => {
                const val = parseFloat(e.target.value)
                if (!Number.isNaN(val)) patch({ defaultSplitPercentage: clampPct(val) })
              }}
              placeholder="e.g. 50"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Used for new artists when no individual split rate has been set.
            </p>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-split-digital">Digital Split (%) – optional</Label>
              <Input
                id="default-split-digital"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={defaults.defaultSplitPercentageDigital ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') {
                    patch({ defaultSplitPercentageDigital: undefined })
                  } else {
                    const val = parseFloat(raw)
                    if (!Number.isNaN(val)) patch({ defaultSplitPercentageDigital: clampPct(val) })
                  }
                }}
                placeholder="Empty = global rate"
              />
              <p className="text-xs text-muted-foreground">
                Overrides global split for streaming revenue.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-split-physical">Physical/Merch Split (%) – optional</Label>
              <Input
                id="default-split-physical"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={defaults.defaultSplitPercentagePhysical ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') {
                    patch({ defaultSplitPercentagePhysical: undefined })
                  } else {
                    const val = parseFloat(raw)
                    if (!Number.isNaN(val)) patch({ defaultSplitPercentagePhysical: clampPct(val) })
                  }
                }}
                placeholder="Empty = global rate"
              />
              <p className="text-xs text-muted-foreground">
                Overrides global split for physical / merch revenue.
              </p>
            </div>
          </div>
        </div>

        {/* ── Distribution Fee ───────────────────────────── */}
        <div className="space-y-4">
          <SectionHeading icon={Percent} title="Label Distribution Fee" />

          <div className="space-y-2">
            <Label htmlFor="distribution-fee">Global Distribution Fee (%)</Label>
            <Input
              id="distribution-fee"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={defaults.distributionFeePercentage ?? 0}
              onChange={e => {
                const val = parseFloat(e.target.value)
                if (!Number.isNaN(val)) patch({ distributionFeePercentage: clampPct(val) })
              }}
              placeholder="e.g. 15"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Retained from each artist&apos;s revenue before the split rate is applied. 0% = no fee.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="distribution-fee-digital">Digital Fee (%) – optional</Label>
              <Input
                id="distribution-fee-digital"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={defaults.distributionFeeDigital ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') {
                    patch({ distributionFeeDigital: undefined })
                  } else {
                    const val = parseFloat(raw)
                    if (!Number.isNaN(val)) patch({ distributionFeeDigital: clampPct(val) })
                  }
                }}
                placeholder="Empty = global rate"
              />
              <p className="text-xs text-muted-foreground">Overrides global rate for streaming.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distribution-fee-physical">Physical/Merch Fee (%) – optional</Label>
              <Input
                id="distribution-fee-physical"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={defaults.distributionFeePhysical ?? ''}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') {
                    patch({ distributionFeePhysical: undefined })
                  } else {
                    const val = parseFloat(raw)
                    if (!Number.isNaN(val)) patch({ distributionFeePhysical: clampPct(val) })
                  }
                }}
                placeholder="Empty = global rate"
              />
              <p className="text-xs text-muted-foreground">Overrides global rate for physical / merch.</p>
            </div>
          </div>
        </div>

        {/* ── Per-Source Split Overrides ─────────────────── */}
        <div className="space-y-4">
          <SectionHeading icon={Database} title="Global Source Split Rates" />
          <p className="text-xs text-muted-foreground">
            Per-data-source default splits applied to ALL artists when no artist-specific rule exists.
            Overrides the global split rate for that source only.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                { id: 'source-believe',  key: 'believe',  label: 'Believe (Digital / Streaming)' },
                { id: 'source-bandcamp', key: 'bandcamp', label: 'Bandcamp' },
                { id: 'source-darkmerch', key: 'darkmerch', label: 'Darkmerch / Merchandise' },
                { id: 'source-physical', key: 'physical', label: 'Physical (Shopify / Printful)' },
              ] as const
            ).map(({ id, key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={id}>{label} (%) – optional</Label>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={defaults.sourceSplits?.[key] ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    if (raw === '') {
                      patch({ sourceSplits: { ...defaults.sourceSplits, [key]: undefined } })
                    } else {
                      const val = parseFloat(raw)
                      if (!Number.isNaN(val)) {
                        patch({ sourceSplits: { ...defaults.sourceSplits, [key]: clampPct(val) } })
                      }
                    }
                  }}
                  placeholder="Empty = global rate"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Invoice Deadline ───────────────────────────── */}
        <div className="space-y-4">
          <SectionHeading icon={CalendarBlank} title="Invoice Deadline" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline-days">Payment Deadline (days)</Label>
              <Input
                id="deadline-days"
                type="number"
                min={1}
                max={365}
                step={1}
                value={defaults.invoiceDeadlineDays}
                onChange={e => {
                  const val = parseInt(e.target.value, 10)
                  if (!Number.isNaN(val)) patch({ invoiceDeadlineDays: Math.max(1, val) })
                }}
                placeholder="e.g. 25"
              />
              <p className="text-xs text-muted-foreground">
                Days after statement delivery within which artists must submit their invoice.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline-date">Specific due date (optional)</Label>
              <Input
                id="deadline-date"
                type="text"
                value={defaults.invoiceDeadlineDate}
                onChange={e => patch({ invoiceDeadlineDate: e.target.value })}
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
              onChange={e => patch({ royaltyDonationOrg: e.target.value })}
              placeholder="e.g. Animal Shelter"
            />
            <p className="text-xs text-muted-foreground">
              Non-profit organisation to which unclaimed royalties will be donated.
            </p>
          </div>
        </div>

        {/* ── Finance Contact ────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeading icon={EnvelopeSimple} title="Invoice Receipt" />

          <div className="space-y-2">
            <Label htmlFor="finance-email">Finance Email</Label>
            <Input
              id="finance-email"
              type="email"
              value={defaults.financeEmail}
              onChange={e => patch({ financeEmail: e.target.value })}
              placeholder="e.g. finance@label.com"
            />
            <p className="text-xs text-muted-foreground">
              Artists send their invoice to this address. Used as {'{invoice_email}'} in templates.
            </p>
          </div>
        </div>

      </Card>
    </div>
  )
}

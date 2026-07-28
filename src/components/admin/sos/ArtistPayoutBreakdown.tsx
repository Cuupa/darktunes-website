'use client'

import type { ArtistRevenue } from '@/lib/sos/types'
import { computeOtherDigitalRevenue } from '@/lib/sos/artistPayoutBreakdown'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

function fmtEur(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value)
}

interface ArtistPayoutBreakdownProps {
  revenue: ArtistRevenue | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArtistPayoutBreakdown({ revenue, open, onOpenChange }: ArtistPayoutBreakdownProps) {
  const t = useAccountingLabels()

  if (!revenue) return null

  const otherDigital = computeOtherDigitalRevenue(revenue)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" data-lenis-prevent>
        <SheetHeader>
          <SheetTitle>{revenue.artist}</SheetTitle>
          <SheetDescription>{t.payoutBreakdownDesc}</SheetDescription>
        </SheetHeader>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Believe Digital</dt>
            <dd>{fmtEur(revenue.believeRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Bandcamp Digital</dt>
            <dd>{fmtEur(revenue.bandcampRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.payoutBreakdownOtherDigital}</dt>
            <dd>{fmtEur(otherDigital)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.payoutBreakdownPhysical}</dt>
            <dd>{fmtEur(revenue.physicalReleasesRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Darkmerch</dt>
            <dd>{fmtEur(revenue.darkmerchRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.payoutBreakdownManual}</dt>
            <dd>{fmtEur(revenue.manualRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3 font-medium">
            <dt>{t.payoutBreakdownGross}</dt>
            <dd>{fmtEur(revenue.totalRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-destructive">
            <dt>{t.payoutBreakdownDistFee}</dt>
            <dd>{fmtEur(revenue.distributionFeeDeducted)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-destructive">
            <dt>{t.payoutBreakdownExpenses}</dt>
            <dd>{fmtEur(revenue.totalExpenses)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <dt>{t.payoutBreakdownSplit}</dt>
            <dd>
              {revenue.digitalSplitPercentage}% / {revenue.physicalSplitPercentage}% /{' '}
              {revenue.darkmerchSplitPercentage}%
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold text-emerald-400">
            <dt>{t.payoutBreakdownPayout}</dt>
            <dd>{fmtEur(revenue.finalAmount)}</dd>
          </div>
        </dl>
      </SheetContent>
    </Sheet>
  )
}

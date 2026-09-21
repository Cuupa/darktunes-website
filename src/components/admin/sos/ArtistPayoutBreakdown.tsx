'use client'

import type { AppDefaults, ArtistRevenue, SplitFee } from '@/lib/sos/types'
import {
  computeOtherDigitalRevenue,
  explainAppliedSplits,
  type SplitOriginId,
} from '@/lib/sos/artistPayoutBreakdown'
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

function originLabel(
  t: ReturnType<typeof useAccountingLabels>,
  origin: SplitOriginId,
): string {
  switch (origin) {
    case 'artist-source':
      return t.payoutOriginArtistSource
    case 'global-source':
      return t.payoutOriginGlobalSource
    case 'artist-digital':
      return t.payoutOriginArtistDigital
    case 'artist-physical':
      return t.payoutOriginArtistPhysical
    case 'default-digital':
      return t.payoutOriginDefaultDigital
    case 'default-physical':
      return t.payoutOriginDefaultPhysical
    case 'artist':
      return t.payoutOriginArtist
    default:
      return t.payoutOriginDefault
  }
}

interface ArtistPayoutBreakdownProps {
  revenue: ArtistRevenue | null
  open: boolean
  onOpenChange: (open: boolean) => void
  splitFees?: SplitFee[]
  appDefaults?: Partial<AppDefaults>
}

export function ArtistPayoutBreakdown({
  revenue,
  open,
  onOpenChange,
  splitFees = [],
  appDefaults,
}: ArtistPayoutBreakdownProps) {
  const t = useAccountingLabels()

  if (!revenue) return null

  const otherDigital = computeOtherDigitalRevenue(revenue)
  const origins = explainAppliedSplits(revenue.artist, splitFees, {
    defaultSplitPercentage: appDefaults?.defaultSplitPercentage ?? 50,
    defaultSplitPercentageDigital: appDefaults?.defaultSplitPercentageDigital,
    defaultSplitPercentagePhysical: appDefaults?.defaultSplitPercentagePhysical,
    sourceSplits: appDefaults?.sourceSplits,
  })

  const originLine = (percent: number, origin: SplitOriginId) =>
    `${percent}% · ${originLabel(t, origin)}`

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
          <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt>Believe</dt>
              <dd>{originLine(revenue.believeSplitPercentage, origins.believe.origin)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Bandcamp</dt>
              <dd>{originLine(revenue.bandcampSplitPercentage, origins.bandcamp.origin)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.payoutBreakdownPhysical}</dt>
              <dd>{originLine(revenue.physicalSplitPercentage, origins.physical.origin)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Darkmerch</dt>
              <dd>{originLine(revenue.darkmerchSplitPercentage, origins.darkmerch.origin)}</dd>
            </div>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold text-emerald-400">
            <dt>{t.payoutBreakdownPayout}</dt>
            <dd>{fmtEur(revenue.finalAmount)}</dd>
          </div>
          {revenue.openingBalanceEur != null && (
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{t.payoutBreakdownOpening}</dt>
              <dd>{fmtEur(revenue.openingBalanceEur)}</dd>
            </div>
          )}
          {revenue.amountDueEur != null && (
            <div className="flex justify-between gap-4 text-sm font-medium">
              <dt>{t.payoutBreakdownDue}</dt>
              <dd>{fmtEur(revenue.amountDueEur)}</dd>
            </div>
          )}
        </dl>
      </SheetContent>
    </Sheet>
  )
}

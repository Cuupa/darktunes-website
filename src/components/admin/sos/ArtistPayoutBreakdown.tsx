'use client'

import type { ArtistRevenue } from '@/lib/sos/types'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

interface ArtistPayoutBreakdownProps {
  revenue: ArtistRevenue | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArtistPayoutBreakdown({ revenue, open, onOpenChange }: ArtistPayoutBreakdownProps) {
  if (!revenue) return null

  const digitalGross =
    revenue.believeRevenue + revenue.bandcampRevenue + (revenue.totalRevenue - revenue.physicalReleasesRevenue - revenue.believeRevenue - revenue.bandcampRevenue - revenue.darkmerchRevenue)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{revenue.artist}</SheetTitle>
          <SheetDescription>Aufschlüsselung: Umsatz → Gebühr → Split → Auszahlung</SheetDescription>
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
            <dt className="text-muted-foreground">Sonstiges Digital</dt>
            <dd>{fmtEur(Math.max(0, digitalGross))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Physical Releases</dt>
            <dd>{fmtEur(revenue.physicalReleasesRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Darkmerch</dt>
            <dd>{fmtEur(revenue.darkmerchRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Manueller Umsatz</dt>
            <dd>{fmtEur(revenue.manualRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3 font-medium">
            <dt>Brutto gesamt</dt>
            <dd>{fmtEur(revenue.totalRevenue)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-destructive">
            <dt>− Vertriebsgebühr</dt>
            <dd>{fmtEur(revenue.distributionFeeDeducted)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-destructive">
            <dt>− Ausgaben</dt>
            <dd>{fmtEur(revenue.totalExpenses)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <dt>Split (Digital / Physical / Merch)</dt>
            <dd>
              {revenue.digitalSplitPercentage}% / {revenue.physicalSplitPercentage}% /{' '}
              {revenue.darkmerchSplitPercentage}%
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold text-emerald-400">
            <dt>Auszahlung</dt>
            <dd>{fmtEur(revenue.finalAmount)}</dd>
          </div>
        </dl>
      </SheetContent>
    </Sheet>
  )
}
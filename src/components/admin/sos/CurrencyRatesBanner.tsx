'use client'

import { ArrowsClockwise, Warning, CheckCircle, CircleNotch } from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ExchangeRateSource } from '@/lib/sos/currency'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

export interface CurrencyRatesBannerProps {
  loading: boolean
  source: ExchangeRateSource | 'unknown'
  onRefresh: () => void | Promise<void>
  className?: string
}

/**
 * Sticky FX status for accounting. Always show while loading or on fallback;
 * live ECB is a quiet success strip so DAUs still know rates are real.
 */
export function CurrencyRatesBanner({
  loading,
  source,
  onRefresh,
  className,
}: CurrencyRatesBannerProps) {
  const t = useAccountingLabels()

  if (loading && source === 'unknown') {
    return (
      <Alert className={className ?? 'mx-6 mt-4 border-border bg-muted/20'}>
        <CircleNotch size={16} className="animate-spin text-muted-foreground" aria-hidden="true" />
        <AlertTitle className="text-sm">{t.currencyRatesLoading}</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          {t.currencyRatesLoadingHint}
        </AlertDescription>
      </Alert>
    )
  }

  if (source === 'fallback') {
    return (
      <Alert variant="destructive" className={className ?? 'mx-6 mt-4'}>
        <Warning size={16} aria-hidden="true" />
        <AlertTitle className="text-sm">{t.currencyFallbackTitle}</AlertTitle>
        <AlertDescription className="text-xs space-y-2">
          <p>{t.currencyFallbackDescription}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={loading}
            onClick={() => void onRefresh()}
          >
            {loading ? (
              <CircleNotch size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowsClockwise size={14} aria-hidden="true" />
            )}
            {t.currencyRefreshButton}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (source === 'ecb') {
    return (
      <Alert className={className ?? 'mx-6 mt-4 border-emerald-500/30 bg-emerald-500/5'}>
        <CheckCircle size={16} className="text-emerald-400" aria-hidden="true" />
        <AlertTitle className="text-sm">{t.currencyRatesLive}</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          <span>{t.currencyRatesLiveHint}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => void onRefresh()}
          >
            {loading ? (
              <CircleNotch size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowsClockwise size={12} aria-hidden="true" />
            )}
            {t.currencyRefreshButton}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

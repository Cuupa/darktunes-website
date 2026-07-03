'use client'

import { useTranslations } from 'next-intl'
import { ShoppingBag } from '@phosphor-icons/react'
import type { MerchOrderStats } from '@/lib/api/merchOrders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnalyticsStatCard } from './AnalyticsStatCard'

interface MerchTabProps {
  stats: MerchOrderStats
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function MerchTab({ stats }: MerchTabProps) {
  const t = useTranslations('portal')

  if (stats.totalOrders === 0) {
    return (
      <p className="text-muted-foreground">{t('analytics_merch_noData')}</p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">{t('analytics_merch_heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('analytics_merch_hint')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard label={t('analytics_merch_orders')} value={stats.totalOrders} icon={ShoppingBag} />
        <AnalyticsStatCard label={t('analytics_merch_quantity')} value={stats.totalQuantity} icon={ShoppingBag} />
        <AnalyticsStatCard label={t('analytics_merch_revenue')} value={formatEur(stats.totalRevenueEur)} icon={ShoppingBag} />
        <AnalyticsStatCard label={t('analytics_merch_shopify')} value={stats.bySource.shopify} icon={ShoppingBag} />
      </div>

      {stats.topProducts.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics_merch_products_title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-clip overscroll-x-contain" data-lenis-prevent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">{t('analytics_merch_col_product')}</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_merch_col_qty')}</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_merch_col_revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topProducts.map((row) => (
                    <tr key={row.productTitle} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{row.productTitle}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono">{formatEur(row.revenueEur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
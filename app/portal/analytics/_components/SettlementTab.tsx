'use client'

import { useTranslations } from 'next-intl'
import type { ArtistSettlementSummary } from '@/lib/api/settlementLedger'
import type { LedgerEntry } from '@/lib/api/settlementLedger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyEur, Scales } from '@phosphor-icons/react'
import type { PortalMessageKey } from '@/i18n/portalKey'

interface SettlementTabProps {
  summary: ArtistSettlementSummary
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

const ENTRY_TYPE_KEYS: Record<LedgerEntry['entryType'], PortalMessageKey> = {
  statement_payout: 'analytics_settlement_type_statement_payout',
  invoice_liability: 'analytics_settlement_type_invoice_liability',
  payment: 'analytics_settlement_type_payment',
  carry_in: 'analytics_settlement_type_carry_in',
  carry_out: 'analytics_settlement_type_carry_out',
  correction: 'analytics_settlement_type_correction',
  opening_balance: 'analytics_settlement_type_opening_balance',
  partial_payment: 'analytics_settlement_type_partial_payment',
}

export function SettlementTab({ summary }: SettlementTabProps) {
  const t = useTranslations('portal')

  if (summary.recentEntries.length === 0 && summary.balanceEur === 0) {
    return (
      <p className="text-muted-foreground">{t('analytics_settlement_noData')}</p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">{t('analytics_settlement_heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('analytics_settlement_hint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Scales size={12} aria-hidden="true" />
              {t('analytics_settlement_balance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono tabular-nums">{formatEur(summary.balanceEur)}</p>
          </CardContent>
        </Card>
        {summary.latestCarryForwardEur !== null && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <CurrencyEur size={12} aria-hidden="true" />
                {t('analytics_settlement_carry_forward')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold font-mono tabular-nums">
                {formatEur(summary.latestCarryForwardEur)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {summary.recentEntries.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics_settlement_ledger_title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">{t('analytics_settlement_col_date')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('analytics_settlement_col_type')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('analytics_settlement_col_description')}</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_settlement_col_amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">{t(ENTRY_TYPE_KEYS[entry.entryType])}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {entry.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono">
                        {formatEur(entry.amountEur)}
                      </td>
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
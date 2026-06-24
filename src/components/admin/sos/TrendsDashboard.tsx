'use client'

/**
 * src/components/admin/sos/TrendsDashboard.tsx
 *
 * Multi-period revenue trend view built from sos_period_summaries.
 * Displays revenue and payout over time using recharts AreaChart.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendUp, CalendarBlank, FloppyDisk } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RevenueSummaryCard } from './RevenueSummaryCard'
import type { ArtistRevenue } from '@/lib/sos/types'

interface PeriodSummary {
  id: string
  period_start: string
  period_end: string
  total_revenue: number
  total_payout: number
  artist_count: number
  source_batch_ids?: string[]
  created_at: string
}

interface TrendsDashboardProps {
  /** Current period revenues — used to save a new summary on demand. */
  revenues?: ArtistRevenue[]
  periodStart?: string
  periodEnd?: string
  bronzeBatchIds?: string[]
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtShort(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`
  return fmtEur(n)
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: 12,
}

export function TrendsDashboard({
  revenues = [],
  periodStart = '',
  periodEnd = '',
  bronzeBatchIds = [],
}: TrendsDashboardProps) {
  const [summaries, setSummaries] = useState<PeriodSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const loadSummaries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/sos/period-summaries')
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error ?? 'Failed to load period summaries')
      }
      const data = await res.json() as { summaries: PeriodSummary[] }
      setSummaries((data.summaries ?? []).sort((a, b) => a.period_start.localeCompare(b.period_start)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load period summaries')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummaries()
  }, [loadSummaries])

  const handleSavePeriod = useCallback(async () => {
    if (!periodStart || revenues.length === 0) return
    setIsSaving(true)
    try {
      const total_revenue = revenues.reduce((s, r) => s + r.totalRevenue, 0)
      const total_payout = revenues.reduce((s, r) => s + r.finalAmount, 0)
      const res = await fetch('/api/admin/sos/period-summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd || periodStart,
          total_revenue,
          total_payout,
          artist_count: revenues.length,
          artist_breakdowns: revenues.map(r => ({ artist: r.artist, revenue: r.totalRevenue, payout: r.finalAmount })),
          platform_breakdowns: revenues.flatMap(r => r.platformBreakdown),
          source_batch_ids: bronzeBatchIds,
        }),
      })
      const payload = await res.json().catch(() => ({})) as { error?: string; updated?: boolean }
      if (res.ok) {
        toast.success(payload.updated ? 'Period summary updated' : 'Period summary saved')
        await loadSummaries()
      } else {
        toast.error(payload.error ?? 'Failed to save period summary')
      }
    } finally {
      setIsSaving(false)
    }
  }, [revenues, periodStart, periodEnd, bronzeBatchIds, loadSummaries])

  const chartData = summaries.map(s => ({
    period: s.period_start,
    Revenue: Number(s.total_revenue),
    Payout: Number(s.total_payout),
  }))

  const latestRevenue = summaries.at(-1)?.total_revenue ?? 0
  const latestPayout = summaries.at(-1)?.total_payout ?? 0

  const effectivePeriodEnd = periodEnd || periodStart
  const currentPeriodExists = useMemo(
    () =>
      summaries.some(
        (s) => s.period_start === periodStart && s.period_end === effectivePeriodEnd,
      ),
    [summaries, periodStart, effectivePeriodEnd],
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendUp size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Revenue Trends</h3>
        </div>

        {revenues.length > 0 && periodStart && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSavePeriod}
            disabled={isSaving}
            className="gap-1.5 text-xs"
          >
            <FloppyDisk size={13} />{' '}
            {currentPeriodExists ? `Update period ${periodStart}` : `Save period ${periodStart}`}
          </Button>
        )}
      </div>

      {summaries.length >= 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <RevenueSummaryCard label="Latest Revenue" value={fmtEur(latestRevenue)} />
          <RevenueSummaryCard label="Latest Payout" value={fmtEur(latestPayout)} />
          <RevenueSummaryCard label="Periods tracked" value={String(summaries.length)} />
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground animate-pulse">Loading historical data…</p>
      )}

      {!isLoading && chartData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <CalendarBlank size={32} className="opacity-30" />
          <p className="text-sm">No historical data yet.</p>
          <p className="text-xs">
            Upload CSV files and click &quot;Save period&quot; (or use Save to Portal in Analytics) to start tracking trends.
          </p>
        </div>
      )}

      {!isLoading && chartData.length >= 2 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-4">Revenue &amp; Payout Over Time</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.28 295)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.28 295)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.60 0.25 300)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.60 0.25 300)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtShort} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number, name: string) => [fmtEur(v), name]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="Revenue"
                stroke="oklch(0.65 0.28 295)"
                fill="url(#revGrad2)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Payout"
                stroke="oklch(0.60 0.25 300)"
                fill="url(#payGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {!isLoading && chartData.length === 1 && (
        <Card className="p-4 text-sm text-muted-foreground text-center">
          1 period saved. Save at least one more to see a trend chart.
        </Card>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  ChartBar,
  CurrencyEur,
  DownloadSimple,
  Globe,
  MagnifyingGlass,
  Users,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ArtistRevenue } from '@/lib/sos/types'
import {
  buildAdminRevenueCsv,
  computeAdminRevenueInsights,
  computeAdminRevenueKpis,
  matchesAdminSearch,
} from '@/lib/analytics/adminInsights'
import { triggerCsvDownload } from '@/lib/analytics/reportExport'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import { SourceMixPanel } from './SourceMixPanel'

interface AdminEnterpriseAnalyticsProps {
  revenues: ArtistRevenue[]
  periodStart?: string
  periodEnd?: string
}

const ALL = '__all__'

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export function AdminEnterpriseAnalytics({
  revenues,
  periodStart,
  periodEnd,
}: AdminEnterpriseAnalyticsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtist, setSelectedArtist] = useState(ALL)
  const [selectedCountry, setSelectedCountry] = useState(ALL)

  const artists = useMemo(
    () => [...new Set(revenues.map((r) => r.artist))].sort(),
    [revenues],
  )

  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const r of revenues) {
      for (const c of r.countryBreakdown) {
        if (c.country) set.add(c.country)
      }
    }
    return [...set].sort()
  }, [revenues])

  const filteredRevenues = useMemo(() => {
    let result = revenues.filter((r) => matchesAdminSearch(searchQuery, r))
    if (selectedArtist !== ALL) {
      result = result.filter((r) => r.artist === selectedArtist)
    }
    if (selectedCountry !== ALL) {
      result = result
        .map((r) => ({
          ...r,
          countryBreakdown: r.countryBreakdown.filter((c) => c.country === selectedCountry),
        }))
        .filter((r) => r.countryBreakdown.length > 0)
    }
    return result
  }, [revenues, searchQuery, selectedArtist, selectedCountry])

  const kpis = useMemo(() => computeAdminRevenueKpis(filteredRevenues), [filteredRevenues])
  const insights = useMemo(() => computeAdminRevenueInsights(filteredRevenues), [filteredRevenues])

  const handleExport = () => {
    const csv = buildAdminRevenueCsv(filteredRevenues)
    const stamp = new Date().toISOString().slice(0, 10)
    triggerCsvDownload(csv, `admin-analytics-${stamp}.csv`)
  }

  if (revenues.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artist or country…"
            className="pl-9 h-9"
            aria-label="Search artist or country"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={selectedArtist} onValueChange={setSelectedArtist}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Artist" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All artists</SelectItem>
              {artists.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
            <DownloadSimple size={14} aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-border bg-card/80">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CurrencyEur size={14} aria-hidden="true" />
            Total revenue
          </div>
          <p className="text-lg font-semibold tabular-nums mt-1">{fmtEur(kpis.totalRevenue)}</p>
        </Card>
        <Card className="p-4 border-border bg-card/80">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ChartBar size={14} aria-hidden="true" />
            Total payout
          </div>
          <p className="text-lg font-semibold tabular-nums mt-1">{fmtEur(kpis.totalPayout)}</p>
        </Card>
        <Card className="p-4 border-border bg-card/80">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users size={14} aria-hidden="true" />
            Artists
          </div>
          <p className="text-lg font-semibold tabular-nums mt-1">{kpis.artistCount}</p>
        </Card>
        <Card className="p-4 border-border bg-card/80">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe size={14} aria-hidden="true" />
            Top country
          </div>
          <p className="text-lg font-semibold mt-1 truncate">{kpis.topCountry ?? '—'}</p>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card className="p-4 border-border bg-card/50 space-y-2">
          <p className="text-sm font-medium">Insights</p>
          {insights.map((insight) => (
            <div key={insight.id} className="text-xs border border-border/60 rounded-md p-2.5">
              <p className="font-medium">{insight.label}</p>
              <p className="text-muted-foreground mt-0.5">{insight.detail}</p>
            </div>
          ))}
        </Card>
      )}

      <SourceMixPanel
        revenues={filteredRevenues}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      <AnalyticsDashboard revenues={filteredRevenues} showSummaryKpis={false} />
    </div>
  )
}
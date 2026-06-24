'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StreamingStat } from '@/lib/api/streamingStats'
import { getAggregatedStreamsByPlatform } from '@/lib/api/streamingStats'
import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'
import { aggregateMetricsByCountry } from '@/lib/api/artistTerritoryMetrics'
import type { EventImpact } from '@/lib/api/eventImpact'
import type { ArtistListenerMetric } from '@/lib/api/artistListenerMetrics'
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { Concert } from '@/types'
import type { Dictionary } from '@/i18n/types'
import {
  EMPTY_ANALYTICS_FILTER,
  collectAvailablePeriods,
  collectAvailablePlatforms,
  collectAvailableCountries,
  filterStreamingStats,
  filterTerritoryMetrics,
  filterListenerMetrics,
  type AnalyticsFilterState,
} from '@/lib/analytics/filterMetrics'
import {
  computeAnalyticsInsights,
  computeAnalyticsKpis,
  matchesQuickSearch,
} from '@/lib/analytics/insights'
import { buildPortalAnalyticsCsv, triggerCsvDownload } from '@/lib/analytics/reportExport'
import { visibleTabIds } from '@/lib/analytics/viewPreferences'
import { AnalyticsFilters } from './AnalyticsFilters'
import { AnalyticsKpiGrid } from './AnalyticsKpiGrid'
import { AnalyticsInsightsPanel } from './AnalyticsInsightsPanel'
import { AnalyticsToolbar, usePortalTabVisibility } from './AnalyticsToolbar'
import { StreamingChart } from './StreamingChart'
import { EarningsChart } from './EarningsChart'
import { EarningsStatementsPanel } from './EarningsStatementsPanel'
import { TerritoriesChart } from './TerritoriesChart'
import { EventImpactChart } from './EventImpactChart'
import { ListenersChart } from './ListenersChart'

interface AnalyticsPageClientProps {
  artistId: string
  billingProfileComplete: boolean
  dict: Dictionary['portal']
  defaultTab: string
  invoicedStatementIds: string[]
  stats: StreamingStat[]
  statements: SalesStatement[]
  territoryMetrics: ArtistTerritoryMetric[]
  eventImpacts: EventImpact[]
  listenerMetrics: ArtistListenerMetric[]
  concerts: Concert[]
}

export function AnalyticsPageClient({
  artistId,
  billingProfileComplete,
  dict,
  defaultTab,
  invoicedStatementIds,
  stats,
  statements,
  territoryMetrics,
  eventImpacts,
  listenerMetrics,
  concerts,
}: AnalyticsPageClientProps) {
  const [filters, setFilters] = useState<AnalyticsFilterState>(EMPTY_ANALYTICS_FILTER)
  const [searchQuery, setSearchQuery] = useState('')
  const [tabVisibility, setTabVisibility] = usePortalTabVisibility()

  const periods = useMemo(
    () => collectAvailablePeriods(stats, territoryMetrics),
    [stats, territoryMetrics],
  )
  const platforms = useMemo(
    () => collectAvailablePlatforms(stats, territoryMetrics),
    [stats, territoryMetrics],
  )
  const countries = useMemo(
    () => collectAvailableCountries(territoryMetrics),
    [territoryMetrics],
  )

  const filteredStats = useMemo(() => {
    const byFilter = filterStreamingStats(stats, filters)
    if (!searchQuery.trim()) return byFilter
    return byFilter.filter((s) =>
      matchesQuickSearch(searchQuery, s.period, s.platform, s.streams),
    )
  }, [stats, filters, searchQuery])

  const filteredTerritory = useMemo(() => {
    const byFilter = filterTerritoryMetrics(territoryMetrics, filters)
    if (!searchQuery.trim()) return byFilter
    return byFilter.filter((m) =>
      matchesQuickSearch(searchQuery, m.period, m.platform, m.country, m.streams, m.revenueEur),
    )
  }, [territoryMetrics, filters, searchQuery])

  const filteredListeners = useMemo(() => {
    const byFilter = filterListenerMetrics(listenerMetrics, filters)
    if (!searchQuery.trim()) return byFilter
    return byFilter.filter((m) =>
      matchesQuickSearch(searchQuery, m.period, m.source, m.metricType, m.value, m.country),
    )
  }, [listenerMetrics, filters, searchQuery])

  const aggregates = useMemo(
    () => getAggregatedStreamsByPlatform(filteredStats),
    [filteredStats],
  )
  const countryAggregates = useMemo(
    () => aggregateMetricsByCountry(filteredTerritory),
    [filteredTerritory],
  )

  const kpis = useMemo(
    () => computeAnalyticsKpis({
      stats: filteredStats,
      territoryMetrics: filteredTerritory,
      listenerMetrics: filteredListeners,
      statements,
    }),
    [filteredStats, filteredTerritory, filteredListeners, statements],
  )

  const insights = useMemo(
    () => computeAnalyticsInsights({
      stats: filteredStats,
      territoryMetrics: filteredTerritory,
      listenerMetrics: filteredListeners,
      eventImpacts,
    }),
    [filteredStats, filteredTerritory, filteredListeners, eventImpacts],
  )

  const visibleTabs = useMemo(() => visibleTabIds(tabVisibility), [tabVisibility])
  const activeDefaultTab = visibleTabs.includes(defaultTab as typeof visibleTabs[number])
    ? defaultTab
    : visibleTabs[0] ?? 'streaming'

  const showFilters = periods.length > 0 || platforms.length > 0 || countries.length > 0

  const handleExport = () => {
    const csv = buildPortalAnalyticsCsv({
      stats: filteredStats,
      territoryMetrics: filteredTerritory,
      listenerMetrics: filteredListeners,
      statements,
    })
    const stamp = new Date().toISOString().slice(0, 10)
    triggerCsvDownload(csv, `analytics-export-${stamp}.csv`)
    toast.success(dict.analytics_export_success)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold">{dict.analytics_dashboard_heading}</h1>
        <p className="text-sm text-muted-foreground">{dict.analytics_dashboard_subheading}</p>
      </div>

      <AnalyticsToolbar
        dict={dict}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        tabVisibility={tabVisibility}
        onTabVisibilityChange={setTabVisibility}
        onExport={handleExport}
      />

      <AnalyticsKpiGrid dict={dict} kpis={kpis} />

      <AnalyticsInsightsPanel dict={dict} insights={insights} />

      {showFilters && (
        <AnalyticsFilters
          dict={dict}
          filters={filters}
          periods={periods}
          platforms={platforms}
          countries={countries}
          onChange={setFilters}
        />
      )}

      <Tabs defaultValue={activeDefaultTab} className="space-y-6">
        <TabsList className="bg-card border border-border flex-wrap h-auto w-full justify-start">
          {visibleTabs.includes('streaming') && (
            <TabsTrigger value="streaming">{dict.analytics_tab_streaming}</TabsTrigger>
          )}
          {visibleTabs.includes('listeners') && (
            <TabsTrigger value="listeners">{dict.analytics_tab_listeners}</TabsTrigger>
          )}
          {visibleTabs.includes('territories') && (
            <TabsTrigger value="territories">{dict.analytics_tab_territories}</TabsTrigger>
          )}
          {visibleTabs.includes('events') && (
            <TabsTrigger value="events">{dict.analytics_tab_events}</TabsTrigger>
          )}
          {visibleTabs.includes('earnings') && (
            <TabsTrigger value="earnings">{dict.analytics_tab_earnings}</TabsTrigger>
          )}
        </TabsList>

        {visibleTabs.includes('streaming') && (
          <TabsContent value="streaming" className="mt-0">
            <StreamingChart
              dict={dict}
              stats={filteredStats}
              aggregates={aggregates}
              concerts={concerts}
            />
          </TabsContent>
        )}

        {visibleTabs.includes('listeners') && (
          <TabsContent value="listeners" className="mt-0">
            <ListenersChart dict={dict} metrics={filteredListeners} />
          </TabsContent>
        )}

        {visibleTabs.includes('territories') && (
          <TabsContent value="territories" className="mt-0 space-y-4">
            <h2 className="text-2xl font-bold">{dict.analytics_territories_heading}</h2>
            <TerritoriesChart dict={dict} countries={countryAggregates} />
          </TabsContent>
        )}

        {visibleTabs.includes('events') && (
          <TabsContent value="events" className="mt-0 space-y-4">
            <h2 className="text-2xl font-bold">{dict.analytics_eventImpact_heading}</h2>
            <EventImpactChart
              dict={dict}
              impacts={eventImpacts}
              concerts={concerts}
            />
          </TabsContent>
        )}

        {visibleTabs.includes('earnings') && (
          <TabsContent value="earnings" className="mt-0 space-y-6">
            <EarningsChart dict={dict} statements={statements} />
            <EarningsStatementsPanel
              artistId={artistId}
              billingProfileComplete={billingProfileComplete}
              dict={dict}
              invoicedStatementIds={invoicedStatementIds}
              searchQuery={searchQuery}
              statements={statements}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
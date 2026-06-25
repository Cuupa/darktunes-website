'use client'

import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { AnalyticsFilterState } from '@/lib/analytics/filterMetrics'

interface AnalyticsFiltersProps {
  filters: AnalyticsFilterState
  periods: string[]
  platforms: string[]
  countries: string[]
  onChange: (next: AnalyticsFilterState) => void
}

const ALL = '__all__'

export function AnalyticsFilters({ filters,
  periods,
  platforms,
  countries,
  onChange,
}: AnalyticsFiltersProps) {
  const t = useTranslations('portal')

  return (
    <div className="flex flex-wrap gap-4 items-end p-4 rounded-lg border border-border bg-card/50">
      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">{t('analytics_filter_from')}</Label>
        <Select
          value={filters.periodFrom || ALL}
          onValueChange={(v) => onChange({ ...filters, periodFrom: v === ALL ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t('analytics_filter_all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('analytics_filter_all')}</SelectItem>
            {periods.map((p) => (
              <SelectItem key={`from-${p}`} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">{t('analytics_filter_to')}</Label>
        <Select
          value={filters.periodTo || ALL}
          onValueChange={(v) => onChange({ ...filters, periodTo: v === ALL ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t('analytics_filter_all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('analytics_filter_all')}</SelectItem>
            {periods.map((p) => (
              <SelectItem key={`to-${p}`} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-[160px]">
        <Label className="text-xs text-muted-foreground">{t('analytics_filter_platform')}</Label>
        <Select
          value={filters.platform || ALL}
          onValueChange={(v) => onChange({ ...filters, platform: v === ALL ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t('analytics_filter_all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('analytics_filter_all')}</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 min-w-[160px]">
        <Label className="text-xs text-muted-foreground">{t('analytics_filter_country')}</Label>
        <Select
          value={filters.country || ALL}
          onValueChange={(v) => onChange({ ...filters, country: v === ALL ? '' : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t('analytics_filter_all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('analytics_filter_all')}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { DownloadSimple, MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  ANALYTICS_TAB_IDS,
  type AnalyticsTabId,
} from '@/lib/analytics/constants'
import {
  loadTabVisibility,
  saveTabVisibility,
  PORTAL_ANALYTICS_VIEW_STORAGE_KEY,
  type TabVisibility,
} from '@/lib/analytics/viewPreferences'
import type { PortalMessageKey } from '@/i18n/portalKey'

interface AnalyticsToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  tabVisibility: TabVisibility
  onTabVisibilityChange: (next: TabVisibility) => void
  onExport: () => void
}

const TAB_LABEL_KEYS: Record<AnalyticsTabId, PortalMessageKey> = {
  streaming: 'analytics_tab_streaming',
  listeners: 'analytics_tab_listeners',
  territories: 'analytics_tab_territories',
  events: 'analytics_tab_events',
  earnings: 'analytics_tab_earnings',
  releases: 'analytics_tab_releases',
  'revenue-mix': 'analytics_tab_revenue_mix',
  press: 'analytics_tab_press',
  settlement: 'analytics_tab_settlement',
  engagement: 'analytics_tab_engagement',
  merch: 'analytics_tab_merch',
}

export function AnalyticsToolbar({ searchQuery,
  onSearchChange,
  tabVisibility,
  onTabVisibilityChange,
  onExport,
}: AnalyticsToolbarProps) {
  const t = useTranslations('portal')

  const [localVisibility, setLocalVisibility] = useState(tabVisibility)

  useEffect(() => {
    setLocalVisibility(tabVisibility)
  }, [tabVisibility])

  const applyVisibility = () => {
    saveTabVisibility(PORTAL_ANALYTICS_VIEW_STORAGE_KEY, localVisibility)
    onTabVisibilityChange(localVisibility)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="relative flex-1 min-w-0">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('analytics_search_placeholder')}
          className="pl-9 h-9"
          aria-label={t('analytics_search_placeholder')}
        />
      </div>

      <div className="flex gap-2 shrink-0">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span className="hidden xs:inline">{t('analytics_customize_views')}</span>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-sm" data-lenis-prevent>
            <SheetHeader>
              <SheetTitle>{t('analytics_customize_views')}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <p className="text-xs text-muted-foreground">{t('analytics_customize_hint')}</p>
              {ANALYTICS_TAB_IDS.map((tabId) => (
                <div key={tabId} className="flex items-center gap-2">
                  <Checkbox
                    id={`tab-${tabId}`}
                    checked={localVisibility[tabId]}
                    onCheckedChange={(checked) =>
                      setLocalVisibility((prev) => ({ ...prev, [tabId]: checked === true }))
                    }
                  />
                  <Label htmlFor={`tab-${tabId}`} className="text-sm font-normal cursor-pointer">
                    {t(TAB_LABEL_KEYS[tabId])}
                  </Label>
                </div>
              ))}
              <Button size="sm" onClick={applyVisibility} className="w-full">
                {t('analytics_customize_apply')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onExport}>
          <DownloadSimple size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{t('analytics_export_csv')}</span>
        </Button>
      </div>
    </div>
  )
}

export function usePortalTabVisibility(): [TabVisibility, (next: TabVisibility) => void] {
  const [visibility, setVisibility] = useState<TabVisibility>(() =>
    loadTabVisibility(PORTAL_ANALYTICS_VIEW_STORAGE_KEY),
  )

  useEffect(() => {
    setVisibility(loadTabVisibility(PORTAL_ANALYTICS_VIEW_STORAGE_KEY))
  }, [])

  return [visibility, setVisibility]
}
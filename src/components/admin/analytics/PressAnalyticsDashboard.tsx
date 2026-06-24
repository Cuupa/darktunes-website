'use client'

import { Newspaper } from '@phosphor-icons/react'
import type { JournalistDownload } from '@/types'
import { aggregatePressEngagement } from '@/lib/analytics/pressEngagement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PressAnalyticsDashboardProps {
  downloads: JournalistDownload[]
}

export function PressAnalyticsDashboard({ downloads }: PressAnalyticsDashboardProps) {
  const summary = aggregatePressEngagement(downloads)

  if (summary.totalDownloads === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No journalist downloads recorded yet.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Newspaper size={12} aria-hidden="true" />
              Total downloads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{summary.totalDownloads}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">
              Last 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{summary.last30Days}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">
              Unique journalists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{summary.uniqueJournalists}</p>
          </CardContent>
        </Card>
      </div>

      {summary.topAssetKeys.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most downloaded assets</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {summary.topAssetKeys.map((item) => (
                <li key={item.assetKey} className="flex justify-between gap-4">
                  <span className="truncate text-muted-foreground font-mono text-xs">
                    {item.assetKey}
                  </span>
                  <span className="tabular-nums shrink-0">{item.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
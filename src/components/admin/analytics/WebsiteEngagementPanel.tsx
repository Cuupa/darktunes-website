'use client'

import { CursorClick, Eye, Users } from '@phosphor-icons/react'
import type { LabelPageEngagementStats } from '@/lib/api/pageEvents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WebsiteEngagementPanelProps {
  stats: LabelPageEngagementStats
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ElementType
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          <Icon size={12} aria-hidden="true" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

export function WebsiteEngagementPanel({ stats }: WebsiteEngagementPanelProps) {
  const hasData = stats.totalViews > 0 || stats.shopClicks > 0

  if (!hasData) {
    return (
      <p className="text-sm text-muted-foreground">
        No website engagement data yet. Page views are recorded when visitors accept analytics cookies on public pages.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Artist page views" value={stats.totalViews.toLocaleString()} icon={Eye} />
        <StatCard label="Views (last 30 days)" value={stats.last30DaysViews.toLocaleString()} icon={Eye} />
        <StatCard label="Merch shop clicks" value={stats.shopClicks.toLocaleString()} icon={CursorClick} />
      </div>

      {stats.topArtists.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users size={16} aria-hidden="true" />
              Top artists by page views
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto overscroll-contain" data-lenis-prevent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">Artist</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topArtists.map((row) => (
                    <tr key={row.artistId} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{row.artistName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.views.toLocaleString()}</td>
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
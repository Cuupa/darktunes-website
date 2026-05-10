'use client'

/**
 * app/portal/_components/PortalOverview.tsx — Client Component (leaf)
 *
 * Renders the dashboard overview cards. Receives all data as props (IoC).
 */

import Link from 'next/link'
import { User, ChartBar, FileText, MusicNotes, MapPin } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary } from '@/i18n/types'

interface PortalOverviewProps {
  dict: Dictionary['portal']
  artistName: string | null
  totalStreams: number
  statementCount: number
  releaseCount: number
  upcomingShowCount: number
}

export function PortalOverview({
  dict,
  artistName,
  totalStreams,
  statementCount,
  releaseCount,
  upcomingShowCount,
}: PortalOverviewProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {dict.welcomeBack}
          {artistName ? `, ${artistName}` : ''}
        </h1>
        {!artistName && (
          <p className="mt-2 text-muted-foreground">{dict.notLinked}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/portal/profile">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.profile}
              </CardTitle>
              <User size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">EPK</p>
              <p className="text-xs text-muted-foreground mt-1">Manage bio, photo &amp; links</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/analytics">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.analytics}
              </CardTitle>
              <ChartBar size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalStreams.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.analytics_totalStreams}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/statements">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.statements}
              </CardTitle>
              <FileText size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{statementCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.statements_heading}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/releases">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.overview_totalReleases}
              </CardTitle>
              <MusicNotes size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{releaseCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.releases_heading}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/tour">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.overview_upcomingShows}
              </CardTitle>
              <MapPin size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{upcomingShowCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.tour_heading}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

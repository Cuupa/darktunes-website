'use client'

/**
 * app/portal/_components/PortalOverview.tsx — Client Component (leaf)
 *
 * Renders the dashboard overview cards. Receives all data as props (IoC).
 */

import Link from 'next/link'
import Image from 'next/image'
import { User, ChartBar, FileText, MusicNotes, MapPin, MegaphoneSimple, ChatCircleText } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { Dictionary } from '@/i18n/types'

interface PortalOverviewProps {
  dict: Dictionary['portal']
  artistName: string | null
  profileImageUrl: string | null
  totalStreams: number
  releaseCount: number
  upcomingShowCount: number
  openChecklistCount: number
  featureFlags: Record<string, boolean>
}

export function PortalOverview({
  dict,
  artistName,
  profileImageUrl,
  totalStreams,
  releaseCount,
  upcomingShowCount,
  openChecklistCount,
  featureFlags,
}: PortalOverviewProps) {
  const isEnabled = (id: string) => featureFlags[id] ?? true

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {profileImageUrl && (
          <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border">
            <Image
              src={getSquareThumbnail(profileImageUrl, 64)}
              alt={`${artistName ?? 'Artist'} – artist photo`}
              fill
              className="object-cover"
            />
          </div>
        )}
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

        {isEnabled('artist.statements') && (
        <Link href="/portal/statements">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.statements}
              </CardTitle>
              <FileText size={18} className="text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">↗</p>
              <p className="text-xs text-muted-foreground mt-1">{dict.statements_heading}</p>
            </CardContent>
          </Card>
        </Link>
        )}

        {isEnabled('artist.releases') && (
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
              <p className="text-xs text-muted-foreground mt-1">{openChecklistCount} open checklist items</p>
            </CardContent>
          </Card>
        </Link>
        )}

        {isEnabled('artist.tour') && (
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
        )}

        {isEnabled('artist.marketing') && (
          <Link href="/portal/marketing">
            <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{dict.marketing}</CardTitle>
                <MegaphoneSimple size={18} className="text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">↗</p>
                <p className="text-xs text-muted-foreground mt-1">{dict.marketing_heading}</p>
              </CardContent>
            </Card>
          </Link>
        )}

        {isEnabled('artist.messages') && (
          <Link href="/portal/messages">
            <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer glow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{dict.messages}</CardTitle>
                <ChatCircleText size={18} className="text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">↗</p>
                <p className="text-xs text-muted-foreground mt-1">{dict.messages_heading}</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
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
  unreadMessageCount: number
  statementCount: number
  assetCount: number
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
  unreadMessageCount,
  statementCount,
  assetCount,
  featureFlags,
}: PortalOverviewProps) {
  const isEnabled = (id: string) => featureFlags[id] ?? true
  const initials = artistName
    ? artistName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-border">
          <AvatarImage
            src={profileImageUrl ? getSquareThumbnail(profileImageUrl, 64) : undefined}
            alt={`${artistName ?? 'Artist'} – artist photo`}
          />
          <AvatarFallback className="bg-primary/20 text-xl font-bold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <h1 className="bg-gradient-to-r from-foreground to-primary/70 bg-clip-text text-3xl font-bold text-transparent">
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
              <p className="text-2xl font-bold">{statementCount}</p>
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
                <p className="text-2xl font-bold">{assetCount}</p>
                <p className="text-xs text-muted-foreground mt-1">label assets available</p>
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
                <p className="text-2xl font-bold">{unreadMessageCount}</p>
                <p className="text-xs text-muted-foreground mt-1">unread messages</p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  )
}

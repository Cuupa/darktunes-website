'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccreditationRequest, JournalistDownload, InterviewRequest } from '@/types'
import { DownloadHistoryTable } from './DownloadHistoryTable'
import { AccreditationList } from './AccreditationList'

interface JournalistDashboardClientProps {
  title: string
  cards: Array<{ href: string; label: string }>
  downloads: JournalistDownload[]
  accreditations: AccreditationRequest[]
  interviews: InterviewRequest[]
  labels: {
    interviews: string
    open: string
    noInterviews: string
    downloadHistory: string
    noDownloads: string
    accreditation: string
    noAccreditations: string
  }
}

export function JournalistDashboardClient({
  title,
  cards,
  downloads,
  accreditations,
  interviews,
  labels,
}: JournalistDashboardClientProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="border-border transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle>{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{labels.open}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{labels.interviews}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.noInterviews}</p>
          ) : (
            interviews.slice(0, 3).map((request) => (
              <div key={request.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{request.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {request.status} · {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DownloadHistoryTable entries={downloads.slice(0, 5)} title={labels.downloadHistory} emptyLabel={labels.noDownloads} />
        <AccreditationList entries={accreditations.slice(0, 5)} title={labels.accreditation} emptyLabel={labels.noAccreditations} />
      </div>
    </div>
  )
}

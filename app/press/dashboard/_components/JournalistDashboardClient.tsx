'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccreditationRequest, JournalistDownload, InterviewRequest } from '@/types'
import { DownloadHistoryTable } from './DownloadHistoryTable'
import { AccreditationList } from './AccreditationList'

interface JournalistDashboardClientProps {
  cardHrefs: string[]
  downloads: JournalistDownload[]
  accreditations: AccreditationRequest[]
  interviews: InterviewRequest[]
}

const CARD_LABEL_KEYS: Record<string, 'profile' | 'promoPool' | 'pressKit' | 'pressReleases' | 'accreditation' | 'contact' | 'downloadHistory' | 'interviews'> = {
  '/press/dashboard/profile': 'profile',
  '/press/dashboard/promo-pool': 'promoPool',
  '/press/dashboard/press-kit': 'pressKit',
  '/press/dashboard/press-releases': 'pressReleases',
  '/press/dashboard/accreditation': 'accreditation',
  '/press/dashboard/contact': 'contact',
  '/press/dashboard/download-history': 'downloadHistory',
  '/press/dashboard/interviews': 'interviews',
}

export function JournalistDashboardClient({
  cardHrefs,
  downloads,
  accreditations,
  interviews,
}: JournalistDashboardClientProps) {
  const t = useTranslations('pressDashboard')

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cardHrefs.map((href) => {
          const labelKey = CARD_LABEL_KEYS[href]
          if (!labelKey) return null
          return (
            <Link key={href} href={href}>
              <Card className="border-border transition-colors hover:border-primary/40">
                <CardHeader>
                  <CardTitle>{t(labelKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t('open')}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('interviews')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noInterviews')}</p>
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
        <DownloadHistoryTable entries={downloads.slice(0, 5)} title={t('downloadHistory')} emptyLabel={t('noDownloads')} />
        <AccreditationList entries={accreditations.slice(0, 5)} title={t('accreditation')} emptyLabel={t('noAccreditations')} />
      </div>
    </div>
  )
}
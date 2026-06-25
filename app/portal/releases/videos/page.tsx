export const dynamic = 'force-dynamic'

import { getLocale, getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getVideoSubmissionsByArtistId } from '@/lib/api/videoSubmissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import type { VideoSubmission } from '@/types'

function statusBadgeVariant(status: VideoSubmission['status']) {
  switch (status) {
    case 'received': return 'secondary'
    case 'reviewed': return 'outline'
    case 'accepted': return 'default'
    case 'rejected': return 'destructive'
    default: return 'secondary'
  }
}

function statusLabel(status: VideoSubmission['status'], t: Awaited<ReturnType<typeof getTranslations<'portal'>>>) {


  switch (status) {
    case 'received': return t('releases_status_received')
    case 'reviewed': return t('releases_status_reviewed')
    case 'accepted': return t('releases_status_accepted')
    case 'rejected': return t('releases_status_rejected')
    default: return status
  }
}

export default async function VideoSubmissionsPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {

  const t = await getTranslations('portal')
  const locale = await getLocale()

  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const artist = user ? await resolvePortalArtist(supabase, user.id, artistId).catch(() => null) : null
  const submissions = artist
    ? await getVideoSubmissionsByArtistId(supabase, artist.id).catch(() => [])
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('video_submissions_heading')}</h1>
        <Button asChild>
          <Link href="/portal/releases/videos/new">{t('video_submit_heading')}</Link>
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className="text-muted-foreground">{t('video_submissions_empty')}</p>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <Card key={sub.id} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{sub.title}</CardTitle>
                <Badge variant={statusBadgeVariant(sub.status)}>
                  {statusLabel(sub.status, t)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {sub.youtubeTitle && (
                  <p className="text-muted-foreground">{sub.youtubeTitle}</p>
                )}
                {sub.targetPublishDate && (
                  <p className="text-muted-foreground">
                    {new Date(sub.targetPublishDate).toLocaleDateString(locale)}
                  </p>
                )}
                {sub.adminReply && (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium mb-1">{t('releases_admin_reply_heading')}</p>
                    <p className="text-muted-foreground">{sub.adminReply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

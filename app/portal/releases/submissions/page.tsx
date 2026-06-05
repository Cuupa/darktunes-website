export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getReleaseSubmissionsByArtistId } from '@/lib/api/releaseSubmissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import type { ReleaseSubmission } from '@/types'
import type { Dictionary } from '@/i18n/types'

function statusBadgeVariant(status: ReleaseSubmission['status']) {
  switch (status) {
    case 'received': return 'secondary'
    case 'reviewed': return 'outline'
    case 'accepted': return 'default'
    case 'rejected': return 'destructive'
    default: return 'secondary'
  }
}

function statusLabel(status: ReleaseSubmission['status'], dict: Dictionary['portal']) {
  switch (status) {
    case 'received': return dict.releases_status_received
    case 'reviewed': return dict.releases_status_reviewed
    case 'accepted': return dict.releases_status_accepted
    case 'rejected': return dict.releases_status_rejected
    default: return status
  }
}

export default async function ReleaseSubmissionsPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  const artist = user ? await getArtistByUserId(supabase, user.id).catch(() => null) : null
  const submissions = artist
    ? await getReleaseSubmissionsByArtistId(supabase, artist.id).catch(() => [])
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{dict.portal.releases_submissions_heading}</h1>
        <Button asChild>
          <Link href="/portal/releases/new">{dict.portal.releases_submit_new}</Link>
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className="text-muted-foreground">{dict.portal.releases_submissions_empty}</p>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <Card key={sub.id} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{sub.title}</CardTitle>
                <Badge variant={statusBadgeVariant(sub.status)}>
                  {statusLabel(sub.status, dict.portal)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex gap-4 text-muted-foreground">
                  {sub.type && <span className="capitalize">{sub.type}</span>}
                  {sub.releaseDate && (
                    <span>{new Date(sub.releaseDate).toLocaleDateString(locale)}</span>
                  )}
                  {sub.genre && <span>{sub.genre}</span>}
                </div>
                {sub.adminReply && (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium mb-1">{dict.portal.releases_admin_reply_heading}</p>
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

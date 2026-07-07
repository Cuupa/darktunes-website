/**
 * app/admin/page.tsx — Admin dashboard overview (Server Component)
 *
 * The middleware.ts at the Edge guarantees only authenticated users reach here.
 * force-dynamic ensures this page is server-rendered on every request.
 */

export const dynamic = 'force-dynamic'

import { AdminOverview } from '@/components/admin/AdminOverview'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const [artists, releases, news, videos] = await Promise.all([
    supabase.from('artists').select('id', { count: 'exact', head: true }),
    supabase.from('releases').select('id', { count: 'exact', head: true }),
    supabase.from('news_posts').select('id', { count: 'exact', head: true }),
    supabase.from('videos').select('id', { count: 'exact', head: true }),
  ])

  return (
    <AdminOverview
      counts={{
        artists: artists.count ?? 0,
        releases: releases.count ?? 0,
        news: news.count ?? 0,
        videos: videos.count ?? 0,
      }}
    />
  )
}

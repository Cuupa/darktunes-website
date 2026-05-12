export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getPressOnlyNewsPosts } from '@/lib/api/news'

export default async function PressReleasesPage() {
  const supabase = await createServerSupabaseClient()
  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  if (flags['journalist.press_releases'] === false) {
    return <p className="text-muted-foreground">Press releases are currently disabled.</p>
  }

  const posts = await getPressOnlyNewsPosts(supabase).catch(() => [])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Press Releases</h1>
      {posts.map((post) => (
        <article key={post.id} className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">{post.title}</h2>
          <p className="text-sm text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString()}</p>
          <p className="mt-2 text-sm whitespace-pre-wrap">{post.excerpt || post.content}</p>
        </article>
      ))}
      {posts.length === 0 && <p className="text-sm text-muted-foreground">No press-only news posts available.</p>}
    </div>
  )
}

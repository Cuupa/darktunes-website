/**
 * app/sitemap.ts — Dynamic XML sitemap (Next.js 15 Metadata API)
 *
 * Served at /sitemap.xml via the Next.js built-in MetadataRoute.
 * Revalidated every hour (ISR) so newly published artists, releases and
 * news posts are indexed within ~1 hour instead of waiting for the next
 * full deploy.
 *
 * Fallbacks (.catch(() => [])) are placed INSIDE each fetch so that a
 * Supabase failure only drops that section instead of breaking the whole
 * sitemap response (per the project-wide unstable_cache error-handling
 * convention in app/page.tsx).
 */

import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPublicArtists } from '@/lib/api/artists'
import { getPublicNewsPosts } from '@/lib/api/news'
import { getPublicReleases } from '@/lib/api/releases'
import { resolveSiteUrl } from '@/lib/brand'

export const revalidate = 3600 // 1 hour ISR

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveSiteUrl()
  const db = createPublicSupabaseClient()
  const now = new Date()

  // Fetch all dynamic slugs/ids in parallel; each has its own fallback
  const [artists, news, releases] = await Promise.all([
    getPublicArtists(db).catch(() => []),
    getPublicNewsPosts(db).catch(() => []),
    getPublicReleases(db).catch(() => []),
  ])

  // ── Static routes ────────────────────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/artists`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/releases`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/news`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/videos`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/press`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/press/apply`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // ── Dynamic artist pages ─────────────────────────────────────────────────
  const artistRoutes: MetadataRoute.Sitemap = artists.map((artist) => ({
    url: `${baseUrl}/artists/${artist.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // ── Dynamic news post pages ──────────────────────────────────────────────
  const newsRoutes: MetadataRoute.Sitemap = news.map((post) => ({
    url: `${baseUrl}/news/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  // ── Dynamic release pages ────────────────────────────────────────────────
  const releaseRoutes: MetadataRoute.Sitemap = releases.map((release) => ({
    url: `${baseUrl}/releases/${release.id}`,
    lastModified: release.releaseDate ? new Date(release.releaseDate) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...artistRoutes, ...newsRoutes, ...releaseRoutes]
}

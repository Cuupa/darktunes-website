'use client'

/**
 * src/components/admin/AdminOverview.tsx
 *
 * Stats overview dashboard shown at /admin (the admin landing page).
 * Displays counts for artists, releases, news, and videos alongside
 * quick-access links to each admin section.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  MusicNotes,
  Newspaper,
  VideoCamera,
  User,
  Wallet,
  ChatCircle,
  Users,
  ToggleRight,
  Gear,
  Cpu,
  ArrowRight,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'

interface StatCounts {
  artists: number
  releases: number
  news: number
  videos: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number | null
  icon: React.ElementType
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
    >
      <div className="rounded-md bg-primary/10 p-2.5 text-primary">
        <Icon size={22} weight="duotone" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tabular-nums">
          {value === null ? '–' : value.toLocaleString()}
        </p>
      </div>
      <ArrowRight
        size={16}
        className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
        aria-hidden="true"
      />
    </Link>
  )
}

const SECTION_LINKS = [
  { label: 'Content',       href: '/admin/content',    icon: MusicNotes,   description: 'Artists, Releases, News, Videos' },
  { label: 'Accounting',    href: '/admin/accounting', icon: Wallet,       description: 'Generate & send SOS statements' },
  { label: 'Messages',      href: '/admin/messages',   icon: ChatCircle,   description: 'Artist inbox messages' },
  { label: 'Users',         href: '/admin/users',      icon: Users,        description: 'Roles, bans, artist links' },
  { label: 'Feature Flags', href: '/admin/features',   icon: ToggleRight,  description: 'Site toggles & rollout flags' },
  { label: 'Settings',      href: '/admin/settings',   icon: Gear,         description: 'Site settings, colors, roles' },
  { label: 'System',        href: '/admin/system',     icon: Cpu,          description: 'Health, logs, media' },
]

export function AdminOverview() {
  const [counts, setCounts] = useState<StatCounts | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const [artists, releases, news, videos] = await Promise.all([
        supabase.from('artists').select('id', { count: 'exact', head: true }),
        supabase.from('releases').select('id', { count: 'exact', head: true }),
        supabase.from('news_posts').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }),
      ])
      if (cancelled) return
      setCounts({
        artists: artists.count ?? 0,
        releases: releases.count ?? 0,
        news: news.count ?? 0,
        videos: videos.count ?? 0,
      })
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-6 space-y-8">
      {/* Stats row */}
      <section aria-label="Content statistics">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Content at a glance
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Artists"  value={counts?.artists  ?? null} icon={User}        href="/admin/content?tab=artists"  />
          <StatCard label="Releases" value={counts?.releases ?? null} icon={MusicNotes}  href="/admin/content?tab=releases" />
          <StatCard label="News"     value={counts?.news     ?? null} icon={Newspaper}   href="/admin/content?tab=news"     />
          <StatCard label="Videos"   value={counts?.videos   ?? null} icon={VideoCamera} href="/admin/content?tab=videos"   />
        </div>
      </section>

      {/* Section links */}
      <section aria-label="Admin sections">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Admin sections
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SECTION_LINKS.map(({ label, href, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <div className="rounded-md bg-muted p-2 mt-0.5 group-hover:bg-primary/10 transition-colors">
                <Icon size={18} weight="duotone" aria-hidden="true" className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

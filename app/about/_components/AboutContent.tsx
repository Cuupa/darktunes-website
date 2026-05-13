'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MarkdownContent } from '@/components/MarkdownContent'
import {
  InstagramLogo, YoutubeLogo, SpotifyLogo,
} from '@phosphor-icons/react'
import type { SiteSettings, Artist, NewsPost } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface AboutContentProps {
  siteSettings: SiteSettings | null
  artists: Artist[]
  news: NewsPost[]
  dict: Dictionary['about']
}

export function AboutContent({ siteSettings, artists, news, dict }: AboutContentProps) {
  const prefersReducedMotion = useReducedMotion()

  const heading = siteSettings?.aboutHeadline || dict.heading
  const subheading = siteSettings?.aboutSubheading || dict.subheading
  const body = siteSettings?.aboutBody || ''

  const stats = [
    { label: 'Artists', value: artists.length },
    { label: 'News Posts', value: news.length },
  ]

  const socialLinks = [
    { url: siteSettings?.instagramUrl, icon: InstagramLogo, label: 'Instagram' },
    { url: siteSettings?.youtubeUrl, icon: YoutubeLogo, label: 'YouTube' },
    { url: siteSettings?.spotifyUrl, icon: SpotifyLogo, label: 'Spotify' },
  ].filter((s) => s.url)

  return (
    <div className="container mx-auto px-4 lg:px-16 pt-36 pb-24 space-y-20">
      {/* Breadcrumb */}
      <div>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase tracking-widest mb-6 inline-block transition-colors">
          ← HOME
        </Link>
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
        >
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mt-2">{heading}</h1>
          <p className="text-xl text-muted-foreground font-serif mt-4">{subheading}</p>
        </motion.div>
      </div>

      {/* Editable body text (Markdown) */}
      {body ? (
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <MarkdownContent content={body} className="max-w-3xl text-lg" />
        </motion.section>
      ) : siteSettings?.labelTagline ? (
        /* Fallback: show hero description when no dedicated about body is set */
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.historyHeading}</h2>
          <p className="text-foreground/80 font-serif text-lg leading-relaxed max-w-3xl">
            {siteSettings.heroDescription || siteSettings.labelTagline}
          </p>
        </motion.section>
      ) : null}

      {/* Stats */}
      {stats.some((s) => s.value > 0) && (
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.statsHeading}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-card border-border p-6 text-center">
                <p className="text-4xl font-bold text-accent">{stat.value}</p>
                <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider mt-2">{stat.label}</p>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* Artist roster preview */}
      {artists.length > 0 && (
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 tracking-tight">Roster</h2>
          <div className="flex flex-wrap gap-2">
            {artists.map((artist) => (
              <Button key={artist.id} variant="outline" size="sm" asChild>
                <Link href={`/artists/${artist.slug}`}>{artist.name}</Link>
              </Button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Social links */}
      {socialLinks.length > 0 && (
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.linksHeading}</h2>
          <div className="flex flex-wrap gap-4">
            {socialLinks.map(({ url, icon: Icon, label }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex items-center gap-2 px-4 py-3 min-h-[44px] rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all font-medium"
              >
                <Icon size={20} weight="fill" aria-hidden="true" />
                {label}
              </a>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  )
}

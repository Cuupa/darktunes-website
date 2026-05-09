'use client'

import Link from 'next/link'
import { InstagramLogo, YoutubeLogo, SpotifyLogo } from '@phosphor-icons/react'
import type { SiteSettings } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface FooterProps {
  siteSettings: SiteSettings
  dict: Dictionary['footer']
}

export function Footer({ siteSettings, dict }: FooterProps) {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">dT</span>
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight uppercase">{siteSettings.labelName}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{dict.musicGroup}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {siteSettings.labelTagline}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">{dict.quickLinks}</h4>
            <nav className="flex flex-col gap-2">
              <a href="#artists" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                {dict.artistsLink}
              </a>
              <a href="#releases" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                {dict.releasesLink}
              </a>
              <a href="#news" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                {dict.newsLink}
              </a>
              <a href="#videos" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                {dict.videosLink}
              </a>
            </nav>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">{dict.followUs}</h4>
            <div className="flex gap-3">
              {siteSettings.instagramUrl && (
                <a
                  href={siteSettings.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <InstagramLogo size={24} weight="fill" />
                </a>
              )}
              {siteSettings.youtubeUrl && (
                <a
                  href={siteSettings.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <YoutubeLogo size={24} weight="fill" />
                </a>
              )}
              {siteSettings.spotifyUrl && (
                <a
                  href={siteSettings.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <SpotifyLogo size={24} weight="fill" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {siteSettings.labelName}. {dict.allRightsReserved}
          </p>
          <div className="flex gap-6">
            <a
              href={`mailto:${siteSettings.contactEmail}`}
              className="text-sm text-muted-foreground hover:text-accent transition-colors"
            >
              {dict.contact}
            </a>
            <Link
              href="/impressum"
              className="text-sm text-muted-foreground hover:text-accent transition-colors"
            >
              {dict.legalNotice}
            </Link>
            <Link
              href="/datenschutz"
              className="text-sm text-muted-foreground hover:text-accent transition-colors"
            >
              {dict.privacyPolicy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

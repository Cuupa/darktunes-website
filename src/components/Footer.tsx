'use client'

import Link from 'next/link'
import Image from 'next/image'
import { InstagramLogo, YoutubeLogo, SpotifyLogo, ShoppingBag, Globe } from '@phosphor-icons/react'
import { useSmoothScrollToAnchor } from '@/hooks/useSmoothScrollToAnchor'
import type { SiteSettings } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { SOCIAL_ICON_MAP } from '@/components/admin/SiteSettingsManager'

interface FooterProps {
  siteSettings: SiteSettings
  dict: Dictionary['footer']
}

export function Footer({ siteSettings, dict }: FooterProps) {
  const handleSmoothScroll = useSmoothScrollToAnchor()

  return (
    <footer className="border-t border-border bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 lg:px-8 py-12 overflow-x-hidden">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-4">
              {siteSettings.logoUrl || siteSettings.faviconUrl ? (
                <Image
                  src={siteSettings.logoUrl || siteSettings.faviconUrl!}
                  alt={`${siteSettings.labelName} logo`}
                  width={160}
                  height={40}
                  className="h-10 w-auto object-contain"
                  style={{ width: 'auto' }}
                  unoptimized
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">dT</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {siteSettings.labelTagline}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">{dict.quickLinks}</h4>
            <nav aria-label="Footer navigation">
              <ul className="flex flex-col gap-2 list-none">
                <li>
                  <Link
                    href="/artists"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {dict.artistsLink}
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.aboutLink ?? 'About'}
                  </Link>
                </li>
                <li>
                  <a href="#releases" onClick={(e) => handleSmoothScroll(e, '#releases')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.releasesLink}
                  </a>
                </li>
                <li>
                  <a href="#news" onClick={(e) => handleSmoothScroll(e, '#news')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.newsLink}
                  </a>
                </li>
                <li>
                  <a href="#videos" onClick={(e) => handleSmoothScroll(e, '#videos')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.videosLink}
                  </a>
                </li>
                <li>
                  <a href="#concerts" onClick={(e) => handleSmoothScroll(e, '#concerts')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.tourLink}
                  </a>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {dict.contactLink}
                  </Link>
                </li>
                <li>
                  <a
                    href={siteSettings.submitHubUrl || 'https://www.submithub.com/playlister/darktunes-music-group'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {dict.submitMusicLink}
                  </a>
                </li>
                {siteSettings.shopifyStoreUrl && (
                  <li>
                    <a
                      href={siteSettings.shopifyStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <ShoppingBag size={14} />
                      {dict.shopLink}
                    </a>
                  </li>
                )}
              </ul>
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
                  aria-label="darkTunes on Instagram"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <InstagramLogo size={24} weight="fill" aria-hidden="true" />
                </a>
              )}
              {siteSettings.youtubeUrl && (
                <a
                  href={siteSettings.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="darkTunes on YouTube"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <YoutubeLogo size={24} weight="fill" aria-hidden="true" />
                </a>
              )}
              {siteSettings.spotifyUrl && (
                <a
                  href={siteSettings.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="darkTunes on Spotify"
                  className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                >
                  <SpotifyLogo size={24} weight="fill" aria-hidden="true" />
                </a>
              )}
              {(siteSettings.customSocialLinks ?? []).map((link) => {
                const IconComponent = SOCIAL_ICON_MAP[link.icon] ?? Globe
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                  >
                    <IconComponent size={24} weight="fill" aria-hidden="true" />
                  </a>
                )
              })}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {siteSettings.labelName}. {dict.allRightsReserved}
          </p>
          <div className="flex gap-6">
            <Link
              href="/contact"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {dict.contact}
            </Link>
            <Link
              href="/impressum"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {dict.legalNotice}
            </Link>
            <Link
              href="/datenschutz"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {dict.privacyPolicy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

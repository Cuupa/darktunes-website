'use client'

import { InstagramLogo, YoutubeLogo, SpotifyLogo } from '@phosphor-icons/react'
import type { SiteSettings } from '@/types'

interface FooterProps {
  siteSettings: SiteSettings
}

export function Footer({ siteSettings }: FooterProps) {
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const target = document.querySelector(href)
      if (target) {
        const headerOffset = 100
        const elementPosition = target.getBoundingClientRect().top
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
      }
    }
  }

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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Music Group</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {siteSettings.labelTagline}
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">Quick Links</h4>
            <nav className="flex flex-col gap-2">
              <a href="#artists" onClick={(e) => handleSmoothScroll(e, '#artists')} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Artists
              </a>
              <a href="#releases" onClick={(e) => handleSmoothScroll(e, '#releases')} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Releases
              </a>
              <a href="#news" onClick={(e) => handleSmoothScroll(e, '#news')} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                News
              </a>
              <a href="#videos" onClick={(e) => handleSmoothScroll(e, '#videos')} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Videos
              </a>
            </nav>
          </div>

          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider">Follow Us</h4>
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
            © {new Date().getFullYear()} {siteSettings.labelName}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href={`mailto:${siteSettings.contactEmail}`} className="text-sm text-muted-foreground hover:text-accent transition-colors">
              Contact
            </a>
            {siteSettings.privacyPolicyUrl && (
              <a href={siteSettings.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Privacy Policy
              </a>
            )}
            {siteSettings.termsUrl && (
              <a href={siteSettings.termsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Terms
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

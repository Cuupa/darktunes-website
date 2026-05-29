'use client'

import Image from 'next/image'
import Link from 'next/link'
import { SpotifyLogo, AppleLogo, LinkSimple, X } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConsentGate } from '@/components/ConsentGate'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface ReleasePreviewModalProps {
  release: Release | null
  open: boolean
  onClose: () => void
  dict: Dictionary['releases']
  consentDict: Dictionary['consent']
}

export function ReleasePreviewModal({ release, open, onClose, dict, consentDict }: ReleasePreviewModalProps) {
  if (!release) return null

  const spotifyEmbedUri = release.spotifyId ? `spotify:album:${release.spotifyId}` : undefined

  const formattedDate = release.releaseDate
    ? new Date(release.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-lg w-full p-0 overflow-hidden bg-card border-border"
      >
        <DialogTitle className="sr-only">{release.title}</DialogTitle>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 rounded-full bg-background/70 backdrop-blur-sm p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col sm:flex-row">
          {/* Cover art */}
          <div className="relative w-full sm:w-48 shrink-0 aspect-square sm:aspect-auto">
            <Image
              src={getOptimizedImageUrl(release.coverArt, 400)}
              alt={`${release.title} by ${release.artistName}`}
              fill
              sizes="(max-width: 640px) 100vw, 192px"
              className="object-cover"
              priority
            />
          </div>

          {/* Info */}
          <div className="flex flex-col gap-3 p-4 flex-1 min-w-0">
            <div>
              <Badge variant="secondary" className="text-xs uppercase tracking-wider mb-2">
                {release.type}
              </Badge>
              <h2 className="text-lg font-bold leading-tight truncate">{release.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{release.artistName}</p>
              {formattedDate && (
                <p className="text-xs text-muted-foreground mt-1">{formattedDate}</p>
              )}
            </div>

            {/* Spotify embed */}
            {spotifyEmbedUri && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {dict.previewTitle}
                </p>
                <ConsentGate label={consentDict.loadSpotify}>
                  <iframe
                    src={`https://open.spotify.com/embed${getSpotifyEmbedPath(spotifyEmbedUri)}`}
                    width="100%"
                    height="80"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-md"
                    title={`${release.title} – Spotify preview`}
                  />
                </ConsentGate>
              </div>
            )}

            {/* Streaming links */}
            {(release.spotifyUrl || release.appleMusicUrl || release.smartUrl) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {dict.streamingLinks}
                </p>
                <div className="flex flex-wrap gap-2">
                  {release.spotifyUrl && (
                    <a
                      href={release.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/30 hover:bg-[#1DB954]/20 transition-colors"
                    >
                      <SpotifyLogo size={12} weight="fill" />
                      Spotify
                    </a>
                  )}
                  {release.appleMusicUrl && (
                    <a
                      href={release.appleMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                    >
                      <AppleLogo size={12} weight="fill" />
                      Apple Music
                    </a>
                  )}
                  {release.smartUrl && (
                    <a
                      href={release.smartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                    >
                      <LinkSimple size={12} />
                      All Links
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* View full page */}
            <Button asChild size="sm" variant="outline" className="mt-auto self-start">
              <Link href={`/releases/${release.id}`}>
                {dict.viewFullPage}
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

/**
 * app/portal/profile/_components/EPKPreview.tsx
 *
 * Professional Electronic Press Kit (EPK) preview component.
 * Renders HTML bios via DOMPurify, supports all artist metadata,
 * and is styled like a real press kit document.
 *
 * Also contains <EPKModal> — a full-screen dialog view of the EPK.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import DOMPurify from 'dompurify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Globe,
  InstagramLogo,
  YoutubeLogo,
  SpotifyLogo,
  AppleLogo,
  FacebookLogo,
  TiktokLogo,
  SoundcloudLogo,
  Envelope,
  MapPin,
  Calendar,
  FilePdf,
  X,
  Link as LinkIcon,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Dictionary } from '@/i18n/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EPKData {
  artistName: string
  photoUrl?: string
  bioShort?: string
  bioMedium?: string
  bioLong?: string
  pressQuote?: string
  genres?: string
  foundingYear?: number | string
  hometown?: string
  bookingContact?: string
  pressContact?: string
  websiteUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  bandcampUrl?: string
  spotifyUrl?: string
  appleMusicUrl?: string
  tiktokUrl?: string
  facebookUrl?: string
  soundcloudUrl?: string
  riderStagePlotUrl?: string
  riderTechnicalUrl?: string
  riderHospitalityUrl?: string
  /** Label name shown in the EPK footer — sourced from site settings. */
  labelName?: string
  /** Label logo URL shown in the EPK footer — sourced from site settings. */
  labelLogoUrl?: string
}

interface EPKPreviewProps {
  dict: Dictionary['portal']
  data: EPKData
  artistSlug?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

/** Detect if a string contains HTML tags */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str)
}

function BioBlock({ html, plain }: { html?: string; plain?: string }) {
  const content = html || plain
  if (!content) return null
  if (isHtml(content)) {
    return (
      <div
        className="prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitize(content) }}
      />
    )
  }
  return <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
}

interface SocialLinkItem {
  href: string
  label: string
  icon: React.ElementType
}

function buildSocialLinks(data: EPKData): SocialLinkItem[] {
  const items: SocialLinkItem[] = []
  if (data.websiteUrl)     items.push({ href: data.websiteUrl,     label: 'Website',      icon: Globe })
  if (data.spotifyUrl)     items.push({ href: data.spotifyUrl,     label: 'Spotify',      icon: SpotifyLogo })
  if (data.appleMusicUrl)  items.push({ href: data.appleMusicUrl,  label: 'Apple Music',  icon: AppleLogo })
  if (data.instagramUrl)   items.push({ href: data.instagramUrl,   label: 'Instagram',    icon: InstagramLogo })
  if (data.youtubeUrl)     items.push({ href: data.youtubeUrl,     label: 'YouTube',      icon: YoutubeLogo })
  if (data.tiktokUrl)      items.push({ href: data.tiktokUrl,      label: 'TikTok',       icon: TiktokLogo })
  if (data.facebookUrl)    items.push({ href: data.facebookUrl,    label: 'Facebook',     icon: FacebookLogo })
  if (data.soundcloudUrl)  items.push({ href: data.soundcloudUrl,  label: 'SoundCloud',   icon: SoundcloudLogo })
  if (data.bandcampUrl)    items.push({ href: data.bandcampUrl,    label: 'Bandcamp',     icon: LinkIcon })
  return items
}

// ---------------------------------------------------------------------------
// EPK Document — the actual press kit layout
// ---------------------------------------------------------------------------

function EPKDocument({ dict, data }: { dict: Dictionary['portal']; data: EPKData }) {
  const genres = data.genres
    ? data.genres.split(',').map((g) => g.trim()).filter(Boolean)
    : []

  const socialLinks = buildSocialLinks(data)

  const hasBio    = data.bioShort || data.bioMedium || data.bioLong
  const hasInfo   = data.foundingYear || data.hometown
  const hasContacts = data.bookingContact || data.pressContact

  return (
    <article className="epk-document bg-card text-foreground rounded-xl overflow-hidden border border-border shadow-lg">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border-b border-border px-8 py-6 flex items-center gap-6">
        {data.photoUrl && (
          <div className="relative w-24 h-24 shrink-0 rounded-full overflow-hidden border-2 border-primary/40">
            <Image
              src={data.photoUrl}
              alt={`${data.artistName} – artist photo`}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-1">
            Electronic Press Kit
          </p>
          <h1 className="text-3xl font-bold truncate">{data.artistName}</h1>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {genres.map((g) => (
                <Badge key={g} variant="secondary" className="text-xs font-normal">
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-7">
        {/* ── Press quote ─────────────────────────────────────────────── */}
        {data.pressQuote && (
          <blockquote className="border-l-4 border-primary/60 pl-4 italic text-foreground/70 text-sm leading-relaxed">
            &ldquo;{data.pressQuote}&rdquo;
          </blockquote>
        )}

        {/* ── Bios ─────────────────────────────────────────────────────── */}
        {hasBio && (
          <section aria-label="Biography">
            {data.bioShort && (
              <div className="mb-4">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  {dict.profile_epk_bio_short_label}
                </h2>
                <BioBlock html={data.bioShort} />
              </div>
            )}
            {data.bioMedium && (
              <div className="mb-4">
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  {dict.profile_epk_bio_medium_label}
                </h2>
                <BioBlock html={data.bioMedium} />
              </div>
            )}
            {data.bioLong && (
              <div>
                <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  {dict.profile_epk_bio_long_label}
                </h2>
                <BioBlock html={data.bioLong} />
              </div>
            )}
          </section>
        )}

        {/* ── Info strip ──────────────────────────────────────────────── */}
        {hasInfo && (
          <>
            <Separator className="bg-border" />
            <section aria-label={dict.profile_epk_info_section}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                {dict.profile_epk_info_section}
              </h2>
              <dl className="flex flex-wrap gap-x-8 gap-y-2">
                {data.foundingYear && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-primary shrink-0" aria-hidden="true" />
                    <dt className="text-xs text-muted-foreground">{dict.profile_epk_founded}:</dt>
                    <dd className="text-sm font-medium">{data.foundingYear}</dd>
                  </div>
                )}
                {data.hometown && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-primary shrink-0" aria-hidden="true" />
                    <dt className="text-xs text-muted-foreground">{dict.profile_epk_origin}:</dt>
                    <dd className="text-sm font-medium">{data.hometown}</dd>
                  </div>
                )}
              </dl>
            </section>
          </>
        )}

        {/* ── Contacts ────────────────────────────────────────────────── */}
        {hasContacts && (
          <>
            <Separator className="bg-border" />
            <section aria-label={dict.profile_epk_contacts_section}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                {dict.profile_epk_contacts_section}
              </h2>
              <dl className="space-y-1.5">
                {data.bookingContact && (
                  <div className="flex items-center gap-2">
                    <Envelope size={14} className="text-primary shrink-0" aria-hidden="true" />
                    <dt className="text-xs text-muted-foreground w-20 shrink-0">{dict.profile_epk_booking}:</dt>
                    <dd className="text-sm break-all">{data.bookingContact}</dd>
                  </div>
                )}
                {data.pressContact && (
                  <div className="flex items-center gap-2">
                    <Envelope size={14} className="text-primary shrink-0" aria-hidden="true" />
                    <dt className="text-xs text-muted-foreground w-20 shrink-0">{dict.profile_epk_press}:</dt>
                    <dd className="text-sm break-all">{data.pressContact}</dd>
                  </div>
                )}
              </dl>
            </section>
          </>
        )}

        {/* ── Rider Documents ─────────────────────────────────────────── */}
        {(data.riderStagePlotUrl || data.riderTechnicalUrl || data.riderHospitalityUrl) && (
          <>
            <Separator className="bg-border" />
            <section aria-label={dict.profile_epk_riders_section}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                {dict.profile_epk_riders_section}
              </h2>
              <ul className="flex flex-wrap gap-3" role="list">
                {data.riderStagePlotUrl && (
                  <li>
                    <a
                      href={data.riderStagePlotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span>{dict.profile_rider_stage_plot}</span>
                    </a>
                  </li>
                )}
                {data.riderTechnicalUrl && (
                  <li>
                    <a
                      href={data.riderTechnicalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span>{dict.profile_rider_technical}</span>
                    </a>
                  </li>
                )}
                {data.riderHospitalityUrl && (
                  <li>
                    <a
                      href={data.riderHospitalityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span>{dict.profile_rider_hospitality}</span>
                    </a>
                  </li>
                )}
              </ul>
            </section>
          </>
        )}

        {/* ── Links ───────────────────────────────────────────────────── */}
        {socialLinks.length > 0 && (
          <>
            <Separator className="bg-border" />
            <section aria-label={dict.profile_epk_links_section}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">
                {dict.profile_epk_links_section}
              </h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="list">
                {socialLinks.map(({ href, label, icon: Icon }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${data.artistName} on ${label}`}
                      className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors break-all"
                    >
                      <Icon size={14} aria-hidden="true" className="shrink-0" />
                      <span>{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-8 py-3 flex items-center justify-between bg-muted/30">
        {data.labelLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.labelLogoUrl}
            alt={data.labelName ?? 'Label logo'}
            className="h-5 w-auto object-contain"
          />
        ) : (
          <p className="text-xs text-muted-foreground tracking-widest uppercase">
            {data.labelName ?? 'Electronic Press Kit'}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{new Date().getFullYear()}</p>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// EPK Modal
// ---------------------------------------------------------------------------

interface EPKModalProps {
  dict: Dictionary['portal']
  data: EPKData
  open: boolean
  onClose: () => void
}

export function EPKModal({ dict, data, open, onClose }: EPKModalProps) {
  const titleId = useId()
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = useCallback(async () => {
    setDownloading(true)
    try {
      const { generateEpkPdf } = await import('./epkPdf')
      await generateEpkPdf(data)
    } catch {
      toast.error(dict.profile_error)
    } finally {
      setDownloading(false)
    }
  }, [data, dict.profile_error])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success(dict.profile_epk_copied)
    })
  }, [dict.profile_epk_copied])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-labelledby={titleId}
      >
        <DialogTitle id={titleId} className="sr-only">
          {dict.profile_epk_preview_heading} — {data.artistName}
        </DialogTitle>

        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 no-print">
          <p className="text-sm font-semibold">{dict.profile_epk_preview_heading}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
              <LinkIcon size={13} aria-hidden="true" />
              {dict.profile_epk_copy_link}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
              className="gap-1.5 text-xs"
            >
              <FilePdf size={13} aria-hidden="true" />
              {downloading ? '…' : dict.profile_download_epk}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8"
              aria-label={dict.profile_epk_close_preview}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 epk-print-area">
          <EPKDocument dict={dict} data={data} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// EPKPreview — inline preview panel (used inside the Profile page)
// ---------------------------------------------------------------------------

export function EPKPreview({ dict, data }: EPKPreviewProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <section ref={previewRef} className="epk-print-area space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{dict.profile_epk_preview_heading}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setModalOpen(true)}
          className="gap-1.5 text-xs"
        >
          <LinkIcon size={13} aria-hidden="true" />
          {dict.profile_epk_open_preview}
        </Button>
      </div>

      {/* Compact preview card */}
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <EPKDocument dict={dict} data={data} />
      </div>

      <EPKModal
        dict={dict}
        data={data}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </section>
  )
}


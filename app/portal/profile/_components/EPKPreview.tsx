'use client'

/**
 * app/portal/profile/_components/EPKPreview.tsx
 *
 * Professional Electronic Press Kit (EPK) preview component.
 * Renders HTML bios via DOMPurify, supports all artist metadata,
 * and is styled like a real press kit document.
 *
 * Features:
 *  - Modular theme architecture (default / blade-runner)
 *  - Section manager (up/down reordering + visibility toggle)
 *  - Optional password protection for sensitive sections
 *
 * Also contains <EPKModal> — a full-screen dialog view of the EPK.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Eye,
  EyeSlash,
  ArrowUp,
  ArrowDown,
  LockKey,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Dictionary } from '@/i18n/types'
import { EPKThemeProvider, useEPKTheme } from '@/lib/epk/EPKThemeContext'
import type { EPKSectionId } from '@/lib/epk/themes'
import { DEFAULT_SECTIONS_ORDER, EPK_THEMES } from '@/lib/epk/themes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EPKData {
  artistName: string
  photoUrl?: string
  /** Additional press/gallery photos */
  photoGallery?: string[]
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
  // theme + section customisation
  epkTheme?: string
  epkSectionsOrder?: string[]
  epkSectionsHidden?: string[]
  /** Custom color tokens used when epkTheme === 'custom' */
  epkCustomThemeTokens?: Record<string, string>
  epkLayout?: 'classic' | 'magazine' | 'minimal' | 'full-bleed'
  epkOrientation?: 'portrait' | 'landscape'
  epkBgImageUrl?: string
  epkBgOpacity?: number
  // password protection
  epkPasswordSections?: string[]
  epkPasswordHash?: string
  /** Label name shown in the EPK footer — sourced from site settings. */
  labelName?: string
  /** Label logo URL shown in the EPK footer — sourced from site settings. */
  labelLogoUrl?: string
}

interface EPKPreviewProps {
  dict: Dictionary['portal']
  data: EPKData
  artistSlug?: string | null
  // EPK customisation — can be passed independently of EPKData (used by ProfileForm)
  epkTheme?: string
  epkSectionsOrder?: string[]
  epkSectionsHidden?: string[]
  epkPasswordHash?: string
  epkPasswordSections?: string[]
  epkCustomThemeTokens?: Record<string, string>
  epkLayout?: EPKData['epkLayout']
  epkOrientation?: EPKData['epkOrientation']
  epkBgImageUrl?: string
  epkBgOpacity?: number
  documentRef?: React.RefObject<HTMLElement | null>
  /** Called when theme/section/password settings change */
  onSettingsChange?: (updates: Partial<Pick<EPKData, 'epkTheme' | 'epkSectionsOrder' | 'epkSectionsHidden' | 'epkPasswordSections' | 'epkPasswordHash' | 'epkCustomThemeTokens' | 'epkLayout' | 'epkOrientation' | 'epkBgImageUrl' | 'epkBgOpacity'>>) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str)
}

function BioBlock({ html, plain }: { html?: string; plain?: string }) {
  const content = html || plain
  if (!content) return null
  if (isHtml(content)) {
    return (
      <div
        suppressHydrationWarning
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
// Section label mapping
// ---------------------------------------------------------------------------

const SECTION_LABEL_KEYS: Record<EPKSectionId, keyof Dictionary['portal']> = {
  header:   'epk_section_header',
  quote:    'epk_section_quote',
  bio:      'epk_section_bio',
  info:     'epk_section_info',
  contacts: 'epk_section_contacts',
  riders:   'epk_section_riders',
  links:    'epk_section_links',
  gallery:  'epk_section_gallery',
}

// ---------------------------------------------------------------------------
// Per-section render blocks
// ---------------------------------------------------------------------------

function SectionHeader({ data }: { data: EPKData }) {
  const theme = useEPKTheme()
  const layout = data.epkLayout ?? 'classic'
  const genres = data.genres
    ? data.genres.split(',').map((g) => g.trim()).filter(Boolean)
    : []
  const imageFrame = data.photoUrl ? (
    <div style={{
      position: 'relative',
      width: 96,
      height: 96,
      flexShrink: 0,
      borderRadius: layout === 'minimal' ? '0.5rem' : '50%',
      overflow: 'hidden',
      border: `2px solid ${theme.accent}40`,
    }}>
      <Image
        src={data.photoUrl}
        alt={`${data.artistName} – artist photo`}
        fill
        className="object-cover"
        sizes="96px"
      />
    </div>
  ) : null

  const headerText = (
    <div style={{ flex: 1, minWidth: 0 }}>
      {layout !== 'minimal' && <p style={theme.headerLabel}>Electronic Press Kit</p>}
      <h1
        style={{
          ...theme.artistName,
          ...(layout === 'minimal'
            ? { textAlign: 'center', fontSize: '2.2rem', marginBottom: '0.5rem' }
            : {}),
        }}
      >
        {data.artistName}
      </h1>
      {genres.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.375rem',
            marginTop: '0.5rem',
            justifyContent: layout === 'minimal' ? 'center' : 'flex-start',
          }}
        >
          {genres.map((g) => (
            <span key={g} style={theme.badge}>{g}</span>
          ))}
        </div>
      )}
    </div>
  )

  if (layout === 'minimal') {
    return (
      <div style={{ ...theme.header, justifyContent: 'center', textAlign: 'center', background: 'transparent' }}>
        {headerText}
      </div>
    )
  }

  if (layout === 'magazine') {
    return (
      <div style={{ ...theme.header, alignItems: 'stretch' }}>
        <div style={{ width: '34%', minWidth: 180, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {imageFrame}
          {data.hometown ? <p style={{ fontSize: '0.78rem', margin: 0, ...theme.mutedText }}>{data.hometown}</p> : null}
          {data.foundingYear ? <p style={{ fontSize: '0.78rem', margin: 0, ...theme.mutedText }}>{data.foundingYear}</p> : null}
        </div>
        <div style={{ width: '66%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {headerText}
        </div>
      </div>
    )
  }

  if (layout === 'full-bleed') {
    const headerBgOpacity = Math.min(100, Math.max(0, data.epkBgOpacity ?? 40)) / 100
    return (
      <div
        style={{
          ...theme.header,
          minHeight: 180,
          alignItems: 'flex-end',
          background: data.epkBgImageUrl
            ? `linear-gradient(rgba(0,0,0,${headerBgOpacity}), rgba(0,0,0,${headerBgOpacity})), url(${data.epkBgImageUrl}) center / cover no-repeat`
            : theme.header.background,
        }}
      >
        {imageFrame}
        {headerText}
      </div>
    )
  }

  return (
    <div style={theme.header}>
      {imageFrame}
      {headerText}
    </div>
  )
}

function SectionQuote({ data }: { data: EPKData }) {
  const theme = useEPKTheme()
  if (!data.pressQuote) return null
  return (
    <blockquote style={theme.blockquote}>
      &ldquo;{data.pressQuote}&rdquo;
    </blockquote>
  )
}

function SectionBio({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  const hasBio = data.bioShort || data.bioMedium || data.bioLong
  if (!hasBio) return null
  return (
    <section aria-label="Biography">
      {data.bioShort && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={theme.sectionHeading}>{dict.profile_epk_bio_short_label}</h2>
          <BioBlock html={data.bioShort} />
        </div>
      )}
      {data.bioMedium && (
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={theme.sectionHeading}>{dict.profile_epk_bio_medium_label}</h2>
          <BioBlock html={data.bioMedium} />
        </div>
      )}
      {data.bioLong && (
        <div>
          <h2 style={theme.sectionHeading}>{dict.profile_epk_bio_long_label}</h2>
          <BioBlock html={data.bioLong} />
        </div>
      )}
    </section>
  )
}

function SectionInfo({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  if (!data.foundingYear && !data.hometown) return null
  return (
    <>
      <div style={theme.divider} role="separator" />
      <section aria-label={dict.profile_epk_info_section}>
        <h2 style={theme.sectionHeading}>{dict.profile_epk_info_section}</h2>
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 2rem' }}>
          {data.foundingYear && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Calendar size={14} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />
              <dt style={{ fontSize: '0.75rem', ...theme.mutedText }}>{dict.profile_epk_founded}:</dt>
              <dd style={{ fontSize: '0.875rem', fontWeight: 500, ...theme.text }}>{data.foundingYear}</dd>
            </div>
          )}
          {data.hometown && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <MapPin size={14} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />
              <dt style={{ fontSize: '0.75rem', ...theme.mutedText }}>{dict.profile_epk_origin}:</dt>
              <dd style={{ fontSize: '0.875rem', fontWeight: 500, ...theme.text }}>{data.hometown}</dd>
            </div>
          )}
        </dl>
      </section>
    </>
  )
}

function SectionContacts({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  if (!data.bookingContact && !data.pressContact) return null
  return (
    <>
      <div style={theme.divider} role="separator" />
      <section aria-label={dict.profile_epk_contacts_section}>
        <h2 style={theme.sectionHeading}>{dict.profile_epk_contacts_section}</h2>
        <dl style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {data.bookingContact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Envelope size={14} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />
              <dt style={{ fontSize: '0.75rem', width: '5rem', flexShrink: 0, ...theme.mutedText }}>{dict.profile_epk_booking}:</dt>
              <dd style={{ fontSize: '0.875rem', wordBreak: 'break-all', ...theme.text }}>{data.bookingContact}</dd>
            </div>
          )}
          {data.pressContact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Envelope size={14} style={{ color: theme.accent, flexShrink: 0 }} aria-hidden="true" />
              <dt style={{ fontSize: '0.75rem', width: '5rem', flexShrink: 0, ...theme.mutedText }}>{dict.profile_epk_press}:</dt>
              <dd style={{ fontSize: '0.875rem', wordBreak: 'break-all', ...theme.text }}>{data.pressContact}</dd>
            </div>
          )}
        </dl>
      </section>
    </>
  )
}

function SectionRiders({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  if (!data.riderStagePlotUrl && !data.riderTechnicalUrl && !data.riderHospitalityUrl) return null
  return (
    <>
      <div style={theme.divider} role="separator" />
      <section aria-label={dict.profile_epk_riders_section}>
        <h2 style={theme.sectionHeading}>{dict.profile_epk_riders_section}</h2>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', listStyle: 'none', margin: 0, padding: 0 }} role="list">
          {data.riderStagePlotUrl && (
            <li>
              <a href={data.riderStagePlotUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: theme.accent }}>
                {dict.profile_rider_stage_plot}
              </a>
            </li>
          )}
          {data.riderTechnicalUrl && (
            <li>
              <a href={data.riderTechnicalUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: theme.accent }}>
                {dict.profile_rider_technical}
              </a>
            </li>
          )}
          {data.riderHospitalityUrl && (
            <li>
              <a href={data.riderHospitalityUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: theme.accent }}>
                {dict.profile_rider_hospitality}
              </a>
            </li>
          )}
        </ul>
      </section>
    </>
  )
}

function SectionLinks({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  const socialLinks = buildSocialLinks(data)
  if (socialLinks.length === 0) return null
  return (
    <>
      <div style={theme.divider} role="separator" />
      <section aria-label={dict.profile_epk_links_section}>
        <h2 style={theme.sectionHeading}>{dict.profile_epk_links_section}</h2>
        <ul style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))',
          gap: '0.5rem',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }} role="list">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer"
                aria-label={`${data.artistName} on ${label}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: theme.accent, wordBreak: 'break-all' }}>
                <Icon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function SectionGallery({ data, dict }: { data: EPKData; dict: Dictionary['portal'] }) {
  const theme = useEPKTheme()
  const photos = data.photoGallery ?? []
  if (photos.length === 0) return null
  return (
    <>
      <div style={theme.divider} role="separator" />
      <section aria-label={dict.epk_gallery_heading}>
        <h2 style={theme.sectionHeading}>{dict.epk_gallery_heading}</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.5rem',
          marginTop: '0.75rem',
        }}>
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`${data.artistName} ${i + 1}`}
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px' }}
            />
          ))}
        </div>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// EPK Document — theme-aware, section-ordered
// ---------------------------------------------------------------------------

function EPKDocument({
  dict,
  data,
  documentRef,
}: {
  dict: Dictionary['portal']
  data: EPKData
  documentRef?: React.RefObject<HTMLElement | null>
}) {
  const theme = useEPKTheme()
  const layout = data.epkLayout ?? 'classic'
  const orientation = data.epkOrientation ?? 'portrait'
  const bgOpacity = Math.min(100, Math.max(0, data.epkBgOpacity ?? (layout === 'full-bleed' ? 40 : 20)))
  const sectionsOrder = (data.epkSectionsOrder ?? DEFAULT_SECTIONS_ORDER) as EPKSectionId[]
  const sectionsHidden = new Set(data.epkSectionsHidden ?? [])

  const sectionMap: Record<EPKSectionId, React.ReactNode> = {
    header:   <SectionHeader   key="header"   data={data} />,
    quote:    <SectionQuote    key="quote"    data={data} />,
    bio:      <SectionBio      key="bio"      data={data} dict={dict} />,
    gallery:  <SectionGallery  key="gallery"  data={data} dict={dict} />,
    info:     <SectionInfo     key="info"     data={data} dict={dict} />,
    contacts: <SectionContacts key="contacts" data={data} dict={dict} />,
    riders:   <SectionRiders   key="riders"   data={data} dict={dict} />,
    links:    <SectionLinks    key="links"    data={data} dict={dict} />,
  }

  const allIds: EPKSectionId[] = DEFAULT_SECTIONS_ORDER
  const visibleSections = sectionsOrder.filter((id) => !sectionsHidden.has(id))
  const extraSections = allIds.filter((id) => !sectionsOrder.includes(id) && !sectionsHidden.has(id))
  const renderOrder = [...visibleSections, ...extraSections]

  const headerNode = !sectionsHidden.has('header') ? sectionMap.header : null
  const bodyNodes = renderOrder.filter((id) => id !== 'header').map((id) => sectionMap[id]).filter(Boolean)
  const articleStyle: React.CSSProperties = {
    ...theme.article,
    position: 'relative',
    overflow: 'hidden',
    aspectRatio: orientation === 'landscape' ? '297 / 210' : '210 / 297',
    width: '100%',
  }

  const bodyStyle: React.CSSProperties = {
    ...theme.body,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.75rem',
    ...(orientation === 'landscape' ? { padding: '1.25rem 2.5rem' } : {}),
  }

  return (
    <article id="epk-document-root" ref={documentRef} className="epk-document" style={articleStyle}>
      {data.epkBgImageUrl ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            opacity: bgOpacity / 100,
            pointerEvents: 'none',
            ...(theme.backgroundImageStyle ?? {}),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.epkBgImageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : null}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {headerNode}
      </div>
      <div style={{ ...bodyStyle, position: 'relative', zIndex: 1 }}>
        {bodyNodes}
      </div>
      <div style={{ ...theme.footer, position: 'relative', zIndex: 1 }}>
        {data.labelLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.labelLogoUrl}
            alt={data.labelName ?? 'Label logo'}
            style={{ height: '1.25rem', width: 'auto', objectFit: 'contain' }}
          />
        ) : (
          <p style={theme.footerText}>
            {data.labelName ?? 'Electronic Press Kit'}
          </p>
        )}
        <p style={theme.footerText}>{new Date().getFullYear()}</p>
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
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[92vh] p-0 gap-0"
        aria-labelledby={titleId}
        aria-describedby={undefined}
      >
        <DialogTitle id={titleId} className="sr-only">
          {dict.profile_epk_preview_heading} — {data.artistName}
        </DialogTitle>
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
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8" aria-label={dict.profile_epk_close_preview}>
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div data-lenis-prevent className="overflow-y-auto max-h-[70vh] p-4 sm:p-6 epk-print-area">
          <EPKThemeProvider themeId={data.epkTheme} customTokens={data.epkCustomThemeTokens}>
            <EPKDocument dict={dict} data={data} />
          </EPKThemeProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Theme Selector
// ---------------------------------------------------------------------------

function EPKThemeSelector({
  dict,
  value,
  onChange,
  customTokens,
  onCustomTokenChange,
}: {
  dict: Dictionary['portal']
  value: string
  onChange: (v: string) => void
  customTokens?: Record<string, string>
  onCustomTokenChange?: (key: string, val: string) => void
}) {
  const themeKeys = Object.keys(EPK_THEMES)
  const themeLabels: Record<string, string> = {
    default: dict.epk_theme_default,
    'blade-runner': dict.epk_theme_blade_runner,
    'neon-underground': dict.epk_theme_neon_underground,
    'industrial-grey': dict.epk_theme_industrial_grey,
    'midnight-forest': dict.epk_theme_midnight_forest,
    'crimson-cult': dict.epk_theme_crimson_cult,
    synthwave: dict.epk_theme_synthwave,
    'print-clean': dict.epk_theme_print_clean,
    custom: dict.epk_theme_custom,
  }
  const themes = [...themeKeys, 'custom'].map((id) => ({
    id,
    label: themeLabels[id] ?? id,
    swatchBg: id === 'custom' ? (customTokens?.bg ?? '#1a1a1a') : (EPK_THEMES[id]?.article.background as string | undefined) ?? '#1a1a1a',
    swatchAccent: id === 'custom' ? (customTokens?.accent ?? '#ffffff') : EPK_THEMES[id]?.accent ?? '#ffffff',
  }))
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {dict.epk_theme_label}
      </Label>
      <div className="flex gap-2 flex-wrap">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={value === t.id}
            className={[
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              value === t.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className="inline-flex w-4 h-4 rounded flex-shrink-0 border border-white/25 items-center justify-center"
              style={{ background: t.swatchBg }}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: t.swatchAccent }} />
            </span>
            {t.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="pt-2 space-y-2">
          <p className="text-xs text-muted-foreground">{dict.epk_custom_colors}</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'bg',      label: dict.epk_color_bg },
              { key: 'text',    label: dict.epk_color_text },
              { key: 'accent',  label: dict.epk_color_accent },
              { key: 'heading', label: dict.epk_color_heading },
            ] as Array<{ key: string; label: string }>).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  id={`epk-color-${key}`}
                  aria-label={label}
                  value={customTokens?.[key] ?? '#ffffff'}
                  onChange={(e) => onCustomTokenChange?.(key, e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border-none bg-transparent p-0"
                />
                <Label htmlFor={`epk-color-${key}`} className="text-xs">{label}</Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orientation / Layout / Background panels
// ---------------------------------------------------------------------------

function EPKOrientationPanel({
  dict,
  value,
  onChange,
}: {
  dict: Dictionary['portal']
  value: 'portrait' | 'landscape'
  onChange: (value: 'portrait' | 'landscape') => void
}) {
  const options: Array<{ id: 'portrait' | 'landscape'; label: string; glyph: string }> = [
    { id: 'portrait', label: dict.epk_orientation_portrait, glyph: '📄' },
    { id: 'landscape', label: dict.epk_orientation_landscape, glyph: '📄↔' },
  ]
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {dict.epk_orientation_label}
      </Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={[
              'inline-flex min-w-[44px] min-h-[44px] items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              value === option.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            ].join(' ')}
          >
            <span aria-hidden="true">{option.glyph}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function EPKLayoutPanel({
  dict,
  value,
  onChange,
}: {
  dict: Dictionary['portal']
  value: NonNullable<EPKData['epkLayout']>
  onChange: (value: NonNullable<EPKData['epkLayout']>) => void
}) {
  const options: Array<{ id: NonNullable<EPKData['epkLayout']>; label: string }> = [
    { id: 'classic', label: dict.epk_layout_classic },
    { id: 'magazine', label: dict.epk_layout_magazine },
    { id: 'minimal', label: dict.epk_layout_minimal },
    { id: 'full-bleed', label: dict.epk_layout_full_bleed },
  ]
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {dict.epk_layout_label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={[
              'rounded-md border p-2 text-left transition-colors',
              value === option.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
            ].join(' ')}
          >
            <div className="rounded border border-border bg-background/70 p-2 h-14">
              {option.id === 'classic' && (
                <div className="h-full flex flex-col gap-1">
                  <div className="h-3 rounded bg-muted" />
                  <div className="h-2 rounded bg-muted/70" />
                  <div className="h-2 rounded bg-muted/70 w-3/4" />
                </div>
              )}
              {option.id === 'magazine' && (
                <div className="h-full grid grid-cols-[1fr_1.5fr] gap-1">
                  <div className="rounded bg-muted h-full" />
                  <div className="flex flex-col gap-1">
                    <div className="h-2 rounded bg-muted/70" />
                    <div className="h-2 rounded bg-muted/70" />
                    <div className="h-2 rounded bg-muted/70 w-5/6" />
                  </div>
                </div>
              )}
              {option.id === 'minimal' && (
                <div className="h-full flex items-center justify-center">
                  <div className="h-2 w-3/4 rounded bg-muted/70" />
                </div>
              )}
              {option.id === 'full-bleed' && (
                <div className="h-full rounded bg-gradient-to-r from-muted to-muted/40 flex items-end p-1">
                  <div className="h-2 w-1/2 rounded bg-background/70" />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs font-medium">{option.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function EPKBackgroundPanel({
  dict,
  data,
  onSettingsChange,
}: {
  dict: Dictionary['portal']
  data: EPKData
  onSettingsChange?: EPKPreviewProps['onSettingsChange']
}) {
  const selectedBg = data.epkBgImageUrl ?? ''
  const bgOpacity = data.epkBgOpacity ?? 20
  const gallery = data.photoGallery ?? []

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {dict.epk_bg_label}
      </Label>
      <div className="space-y-2">
        <Label htmlFor="epk-bg-select" className="text-xs text-muted-foreground">
          {dict.epk_bg_pick_from_gallery}
        </Label>
        <select
          id="epk-bg-select"
          value={selectedBg}
          onChange={(event) => onSettingsChange?.({ epkBgImageUrl: event.target.value || undefined })}
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">—</option>
          {gallery.map((url) => (
            <option key={url} value={url}>{url}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="epk-bg-opacity" className="text-xs text-muted-foreground">
          {dict.epk_bg_opacity}: {bgOpacity}%
        </Label>
        <input
          id="epk-bg-opacity"
          type="range"
          min={0}
          max={100}
          step={1}
          value={bgOpacity}
          onChange={(event) => onSettingsChange?.({ epkBgOpacity: Number(event.target.value) })}
          className="w-full"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSettingsChange?.({ epkBgImageUrl: undefined })}
      >
        {dict.epk_bg_clear}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section Manager
// ---------------------------------------------------------------------------

function EPKSectionManagerPanel({
  dict,
  data,
  onSettingsChange,
}: {
  dict: Dictionary['portal']
  data: EPKData
  onSettingsChange?: EPKPreviewProps['onSettingsChange']
}) {
  const sectionsOrder = (data.epkSectionsOrder ?? DEFAULT_SECTIONS_ORDER) as EPKSectionId[]
  const hiddenSet = new Set(data.epkSectionsHidden ?? [])

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sectionsOrder]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onSettingsChange?.({ epkSectionsOrder: next })
  }

  const toggle = (id: EPKSectionId) => {
    const next = new Set(hiddenSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSettingsChange?.({ epkSectionsHidden: [...next] })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dict.epk_sections_label}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{dict.epk_sections_desc}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-xs shrink-0"
          title={dict.epk_auto_layout_desc}
          onClick={() => {
            // Populated sections float to the top; empty ones sink to the bottom.
            const hasContent: Record<EPKSectionId, boolean> = {
              header:   Boolean(data.artistName),
              quote:    Boolean(data.pressQuote),
              bio:      Boolean(data.bioShort || data.bioMedium || data.bioLong),
              gallery:  (data.photoGallery ?? []).length > 0,
              info:     Boolean(data.genres || data.foundingYear || data.hometown),
              contacts: Boolean(data.bookingContact || data.pressContact),
              riders:   Boolean(data.riderStagePlotUrl || data.riderTechnicalUrl || data.riderHospitalityUrl),
              links:    Boolean(data.websiteUrl || data.instagramUrl || data.youtubeUrl),
            }
            const allIds: EPKSectionId[] = DEFAULT_SECTIONS_ORDER
            const sorted = [...allIds].sort((a, b) => {
              if (hasContent[a] === hasContent[b]) return 0
              return hasContent[a] ? -1 : 1
            })
            onSettingsChange?.({ epkSectionsOrder: sorted })
          }}
        >
          {dict.epk_auto_layout}
        </Button>
      </div>
      <ul className="space-y-1" role="list">
        {sectionsOrder.map((id, index) => {
          const isHidden = hiddenSet.has(id)
          return (
            <li key={id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
              <span className={['flex-1 text-sm', isHidden ? 'line-through text-muted-foreground' : ''].join(' ')}>
                {dict[SECTION_LABEL_KEYS[id] as keyof typeof dict] as string}
              </span>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                aria-label={dict.epk_section_move_up} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp size={12} aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                aria-label={dict.epk_section_move_down} disabled={index === sectionsOrder.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown size={12} aria-hidden="true" />
              </Button>
              <Button type="button" size="icon" variant="ghost"
                className={['h-6 w-6 shrink-0', isHidden ? 'text-muted-foreground' : 'text-foreground'].join(' ')}
                aria-label={isHidden ? dict.epk_section_show : dict.epk_section_hide}
                onClick={() => toggle(id)}>
                {isHidden ? <EyeSlash size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Password Protection panel
// ---------------------------------------------------------------------------

function EPKPasswordPanel({
  dict,
  data,
  onSettingsChange,
}: {
  dict: Dictionary['portal']
  data: EPKData
  onSettingsChange?: EPKPreviewProps['onSettingsChange']
}) {
  const [enabled, setEnabled] = useState(Boolean(data.epkPasswordHash || (data.epkPasswordSections ?? []).length > 0))
  const [password, setPassword] = useState('')
  const protectable: EPKSectionId[] = ['riders', 'links']
  const passwordSections = new Set(data.epkPasswordSections ?? [])

  const handleEnableToggle = () => {
    if (enabled) {
      setEnabled(false)
      setPassword('')
      onSettingsChange?.({ epkPasswordSections: [], epkPasswordHash: undefined })
    } else {
      setEnabled(true)
    }
  }

  const toggleSection = (id: EPKSectionId) => {
    const next = new Set(passwordSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSettingsChange?.({ epkPasswordSections: [...next] })
  }

  const handlePasswordChange = (val: string) => {
    setPassword(val)
    // Signal new plaintext password to parent; API route will hash it server-side.
    onSettingsChange?.({ epkPasswordHash: val ? `__plain__${val}` : undefined })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LockKey size={14} className="text-muted-foreground" aria-hidden="true" />
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dict.epk_password_heading}
          </Label>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleEnableToggle}
          className={['relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-colors', enabled ? 'bg-primary' : 'bg-muted'].join(' ')}
        >
          <span className="sr-only">{dict.epk_password_enable}</span>
          <span className={['pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">{dict.epk_password_desc}</p>
          <div className="space-y-1">
            <Label htmlFor="epk-password" className="text-xs">{dict.epk_password_label}</Label>
            <Input id="epk-password" type="password" autoComplete="new-password"
              placeholder={dict.epk_password_placeholder}
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.epk_password_sections_label}</Label>
            <div className="flex flex-wrap gap-2">
              {protectable.map((id) => (
                <button key={id} type="button" onClick={() => toggleSection(id)} aria-pressed={passwordSections.has(id)}
                  className={['rounded border px-2 py-0.5 text-xs transition-colors', passwordSections.has(id) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'].join(' ')}>
                  {dict[SECTION_LABEL_KEYS[id] as keyof typeof dict] as string}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EPKPreview — inline preview panel (used inside Profile page)
// ---------------------------------------------------------------------------

export function EPKPreview({
  dict,
  data,
  artistSlug,
  epkTheme,
  epkSectionsOrder,
  epkSectionsHidden,
  epkPasswordHash,
  epkPasswordSections,
  epkCustomThemeTokens,
  epkLayout,
  epkOrientation,
  epkBgImageUrl,
  epkBgOpacity,
  onSettingsChange,
  documentRef,
}: EPKPreviewProps) {
  // Merge prop overrides into data for display
  const effectiveData: EPKData = {
    ...data,
    ...(epkTheme !== undefined ? { epkTheme } : {}),
    ...(epkSectionsOrder !== undefined ? { epkSectionsOrder } : {}),
    ...(epkSectionsHidden !== undefined ? { epkSectionsHidden } : {}),
    ...(epkPasswordHash !== undefined ? { epkPasswordHash } : {}),
    ...(epkPasswordSections !== undefined ? { epkPasswordSections } : {}),
    ...(epkCustomThemeTokens !== undefined ? { epkCustomThemeTokens } : {}),
    ...(epkLayout !== undefined ? { epkLayout } : {}),
    ...(epkOrientation !== undefined ? { epkOrientation } : {}),
    ...(epkBgImageUrl !== undefined ? { epkBgImageUrl } : {}),
    ...(epkBgOpacity !== undefined ? { epkBgOpacity } : {}),
  }
  void artistSlug
  const [modalOpen, setModalOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <section ref={previewRef} className="epk-print-area space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{dict.profile_epk_preview_heading}</h2>
        <Button type="button" size="sm" variant="outline" onClick={() => setModalOpen(true)} className="gap-1.5 text-xs">
          <LinkIcon size={13} aria-hidden="true" />
          {dict.profile_epk_open_preview}
        </Button>
      </div>

      <EPKOrientationPanel
        dict={dict}
        value={effectiveData.epkOrientation ?? 'portrait'}
        onChange={(value) => onSettingsChange?.({ epkOrientation: value })}
      />
      <EPKLayoutPanel
        dict={dict}
        value={effectiveData.epkLayout ?? 'classic'}
        onChange={(value) => onSettingsChange?.({ epkLayout: value })}
      />
      <EPKBackgroundPanel
        dict={dict}
        data={effectiveData}
        onSettingsChange={onSettingsChange}
      />
      <EPKThemeSelector
        dict={dict}
        value={effectiveData.epkTheme ?? 'default'}
        onChange={(v) => onSettingsChange?.({ epkTheme: v })}
        customTokens={effectiveData.epkCustomThemeTokens}
        onCustomTokenChange={(key, val) => onSettingsChange?.({ epkCustomThemeTokens: { ...(effectiveData.epkCustomThemeTokens ?? {}), [key]: val } })}
      />
      <EPKSectionManagerPanel dict={dict} data={effectiveData} onSettingsChange={onSettingsChange} />
      <EPKPasswordPanel dict={dict} data={effectiveData} onSettingsChange={onSettingsChange} />

      <div className="rounded-lg border border-border bg-card/50 p-4">
        <EPKThemeProvider themeId={effectiveData.epkTheme} customTokens={effectiveData.epkCustomThemeTokens}>
          <EPKDocument dict={dict} data={effectiveData} documentRef={documentRef} />
        </EPKThemeProvider>
      </div>

      <EPKModal dict={dict} data={effectiveData} open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  )
}

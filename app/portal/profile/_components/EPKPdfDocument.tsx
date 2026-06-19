/**
 * app/portal/profile/_components/EPKPdfDocument.tsx
 *
 * Native, vector-based Electronic Press Kit PDF built with @react-pdf/renderer.
 * Text is fully selectable, file sizes are minimal, and the document never relies
 * on DOM snapshots or canvas exports.
 *
 * Design: dark industrial aesthetic matching the darkTunes brand.
 * Font: Inter (400 / 700 weights) registered via the Font API.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { EPKData } from './EPKPreview'

// ---------------------------------------------------------------------------
// Font registration
// ---------------------------------------------------------------------------

let fontsRegistered = false
let pdfFontFamily = 'Helvetica'

function ensurePdfFontsRegistered(): void {
  if (fontsRegistered) return
  try {
    Font.register({
      family: 'Inter',
      fonts: [
        {
          src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff2',
          fontWeight: 400,
        },
        {
          src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-italic.woff2',
          fontWeight: 400,
          fontStyle: 'italic',
        },
        {
          src: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff2',
          fontWeight: 700,
        },
      ],
    })
    Font.registerHyphenationCallback((word) => [word])
    pdfFontFamily = 'Inter'
  } catch {
    pdfFontFamily = 'Helvetica'
  } finally {
    fontsRegistered = true
  }
}

ensurePdfFontsRegistered()

// ---------------------------------------------------------------------------
// Image proxy helper
// ---------------------------------------------------------------------------

/**
 * Rewrites R2 and Supabase Storage image URLs to go through the server-side
 * `/api/portal/proxy-image` route so that @react-pdf/renderer can fetch them
 * without CORS errors (R2 public buckets do not return CORS headers).
 */
function toProxiedUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    if (
      /^[^.]+\.r2\.dev$/.test(parsed.hostname) ||
      /^[^.]+\.supabase\.co$/.test(parsed.hostname)
    ) {
      return `/api/portal/proxy-image?url=${encodeURIComponent(url)}`
    }
  } catch {
    // Not a valid absolute URL — return as-is (e.g. a data: URI).
  }
  return url
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const T = {
  bg: '#101010',
  surface: '#292929',
  border: '#383838',
  accent: '#493687',
  accentLight: '#6a52a8',
  secondary: '#7e1e37',
  text: '#ffffff',
  muted: '#a0a0a0',
  faint: '#606060',
} as const

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    backgroundColor: T.bg,
    fontFamily: pdfFontFamily,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // --- Hero header -----------------------------------------------------------

  hero: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 20,
  },
  heroPhoto: {
    width: 110,
    height: 110,
    borderRadius: 6,
    objectFit: 'cover',
    flexShrink: 0,
  },
  heroMeta: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  artistName: {
    fontSize: 26,
    fontWeight: 700,
    color: T.text,
    letterSpacing: -0.5,
  },
  genrePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  genrePill: {
    backgroundColor: T.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 8,
    color: T.muted,
    fontWeight: 400,
  },
  labelBadge: {
    marginTop: 6,
    fontSize: 8,
    color: T.faint,
    fontWeight: 400,
  },

  // --- Divider ---------------------------------------------------------------

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    marginVertical: 16,
  },

  // --- Section headings ------------------------------------------------------

  sectionHeading: {
    fontSize: 9,
    fontWeight: 700,
    color: T.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  // --- Press quote -----------------------------------------------------------

  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: T.accent,
    paddingLeft: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: T.text,
    lineHeight: 1.6,
  },

  // --- Bios ------------------------------------------------------------------

  bioBlock: {
    marginBottom: 14,
  },
  bioSubheading: {
    fontSize: 8,
    fontWeight: 700,
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  bodyText: {
    fontSize: 9.5,
    color: T.text,
    lineHeight: 1.65,
  },

  // --- Info row (founded / hometown) -----------------------------------------

  infoRow: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 8,
    color: T.muted,
  },
  infoValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: T.text,
  },

  // --- Contacts --------------------------------------------------------------

  contactRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  contactLabel: {
    fontSize: 8,
    color: T.muted,
    width: 48,
    flexShrink: 0,
  },
  contactValue: {
    fontSize: 8.5,
    color: T.text,
    flex: 1,
  },
  contactLink: {
    fontSize: 8.5,
    color: T.accentLight,
    flex: 1,
  },

  // --- Riders ----------------------------------------------------------------

  riderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  riderLink: {
    fontSize: 8.5,
    color: T.accentLight,
  },

  // --- Social links ----------------------------------------------------------

  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkItem: {
    fontSize: 8.5,
    color: T.accentLight,
    backgroundColor: T.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // --- Gallery ---------------------------------------------------------------

  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 4,
    objectFit: 'cover',
  },

  // --- Footer ----------------------------------------------------------------

  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: T.faint,
  },
  footerLogo: {
    height: 14,
  },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert HTML biography content to plain text for the PDF.
 * Uses DOMParser (available in the browser where this module is loaded) so
 * entity decoding and tag stripping are both handled by the platform's own
 * HTML parser — no regex-based sanitization chains.
 */
function htmlToPlain(raw: string): string {
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html')
    // Insert newlines after block-level elements before extracting text.
    doc.querySelectorAll('br').forEach((el) => el.replaceWith('\n'))
    doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, div').forEach((el) => {
      el.insertAdjacentText('afterend', '\n')
    })
    return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
  } catch {
    // DOMParser is always available in the browser context where this
    // module is loaded. If it somehow throws, return the raw string —
    // react-pdf renders it as literal text, not as HTML.
    return raw.trim()
  }
}

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str)
}

function toPlainText(raw: string): string {
  return isHtml(raw) ? htmlToPlain(raw) : raw.trim()
}

interface SocialLink {
  label: string
  href: string
}

function buildSocialLinks(data: EPKData): SocialLink[] {
  const links: SocialLink[] = []
  if (data.websiteUrl)    links.push({ label: 'Website',       href: data.websiteUrl })
  if (data.spotifyUrl)    links.push({ label: 'Spotify',       href: data.spotifyUrl })
  if (data.appleMusicUrl) links.push({ label: 'Apple Music',   href: data.appleMusicUrl })
  if (data.instagramUrl)  links.push({ label: 'Instagram',     href: data.instagramUrl })
  if (data.youtubeUrl)    links.push({ label: 'YouTube',       href: data.youtubeUrl })
  if (data.tiktokUrl)     links.push({ label: 'TikTok',        href: data.tiktokUrl })
  if (data.facebookUrl)   links.push({ label: 'Facebook',      href: data.facebookUrl })
  if (data.soundcloudUrl) links.push({ label: 'SoundCloud',    href: data.soundcloudUrl })
  if (data.bandcampUrl)   links.push({ label: 'Bandcamp',      href: data.bandcampUrl })
  return links
}

// ---------------------------------------------------------------------------
// Section sub-components
// ---------------------------------------------------------------------------

function HeroSection({ data }: { data: EPKData }) {
  const genres = data.genres
    ? data.genres.split(',').map((g) => g.trim()).filter(Boolean)
    : []

  return (
    <View style={styles.hero} wrap={false}>
      {data.photoUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
        <Image
          src={toProxiedUrl(data.photoUrl)}
          style={styles.heroPhoto}
        />
      ) : null}
      <View style={styles.heroMeta}>
        <Text style={styles.artistName}>{data.artistName}</Text>
        {genres.length > 0 && (
          <View style={styles.genrePills}>
            {genres.map((g) => (
              <Text key={g} style={styles.genrePill}>{g}</Text>
            ))}
          </View>
        )}
        {data.labelName ? (
          <Text style={styles.labelBadge}>{data.labelName}</Text>
        ) : null}
      </View>
    </View>
  )
}

function QuoteSection({ data }: { data: EPKData }) {
  if (!data.pressQuote) return null
  return (
    <>
      <View style={styles.divider} />
      <View style={styles.quoteBlock} wrap={false}>
        <Text style={styles.quoteText}>&ldquo;{data.pressQuote}&rdquo;</Text>
      </View>
    </>
  )
}

function BioSection({ data }: { data: EPKData }) {
  const hasBio = data.bioShort ?? data.bioMedium ?? data.bioLong
  if (!hasBio) return null

  return (
    <>
      <View style={styles.divider} />
      <View>
        <Text style={styles.sectionHeading}>Biography</Text>
        {data.bioShort && (
          <View style={styles.bioBlock} wrap={false}>
            <Text style={styles.bioSubheading}>Short</Text>
            <Text style={styles.bodyText}>{toPlainText(data.bioShort)}</Text>
          </View>
        )}
        {data.bioMedium && (
          <View style={styles.bioBlock} wrap={false}>
            <Text style={styles.bioSubheading}>Medium</Text>
            <Text style={styles.bodyText}>{toPlainText(data.bioMedium)}</Text>
          </View>
        )}
        {data.bioLong && (
          <View style={styles.bioBlock}>
            <Text style={styles.bioSubheading}>Full Biography</Text>
            <Text style={styles.bodyText}>{toPlainText(data.bioLong)}</Text>
          </View>
        )}
      </View>
    </>
  )
}

function InfoSection({ data }: { data: EPKData }) {
  if (!data.foundingYear && !data.hometown) return null
  return (
    <>
      <View style={styles.divider} />
      <View wrap={false}>
        <Text style={styles.sectionHeading}>Info</Text>
        <View style={styles.infoRow}>
          {data.foundingYear && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Founded:</Text>
              <Text style={styles.infoValue}>{String(data.foundingYear)}</Text>
            </View>
          )}
          {data.hometown && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Origin:</Text>
              <Text style={styles.infoValue}>{data.hometown}</Text>
            </View>
          )}
        </View>
      </View>
    </>
  )
}

function ContactsSection({ data }: { data: EPKData }) {
  if (!data.bookingContact && !data.pressContact) return null
  return (
    <>
      <View style={styles.divider} />
      <View wrap={false}>
        <Text style={styles.sectionHeading}>Contacts</Text>
        {data.bookingContact && (
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Booking:</Text>
            {data.bookingContact.includes('@') ? (
              <Link src={`mailto:${data.bookingContact}`} style={styles.contactLink}>
                {data.bookingContact}
              </Link>
            ) : (
              <Text style={styles.contactValue}>{data.bookingContact}</Text>
            )}
          </View>
        )}
        {data.pressContact && (
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Press:</Text>
            {data.pressContact.includes('@') ? (
              <Link src={`mailto:${data.pressContact}`} style={styles.contactLink}>
                {data.pressContact}
              </Link>
            ) : (
              <Text style={styles.contactValue}>{data.pressContact}</Text>
            )}
          </View>
        )}
      </View>
    </>
  )
}

function RidersSection({ data }: { data: EPKData }) {
  if (!data.riderStagePlotUrl && !data.riderTechnicalUrl && !data.riderHospitalityUrl) {
    return null
  }
  return (
    <>
      <View style={styles.divider} />
      <View wrap={false}>
        <Text style={styles.sectionHeading}>Technical Riders</Text>
        <View style={styles.riderRow}>
          {data.riderStagePlotUrl && (
            <Link src={data.riderStagePlotUrl} style={styles.riderLink}>Stage Plot</Link>
          )}
          {data.riderTechnicalUrl && (
            <Link src={data.riderTechnicalUrl} style={styles.riderLink}>Technical Rider</Link>
          )}
          {data.riderHospitalityUrl && (
            <Link src={data.riderHospitalityUrl} style={styles.riderLink}>Hospitality Rider</Link>
          )}
        </View>
      </View>
    </>
  )
}

function LinksSection({ data }: { data: EPKData }) {
  const links = buildSocialLinks(data)
  if (links.length === 0) return null
  return (
    <>
      <View style={styles.divider} />
      <View wrap={false}>
        <Text style={styles.sectionHeading}>Links</Text>
        <View style={styles.linksGrid}>
          {links.map(({ label, href }) => (
            <Link key={href} src={href} style={styles.linkItem}>
              {label}
            </Link>
          ))}
        </View>
      </View>
    </>
  )
}

function GallerySection({ data }: { data: EPKData }) {
  const photos = data.photoGallery ?? []
  if (photos.length === 0) return null
  return (
    <>
      <View style={styles.divider} />
      <View>
        <Text style={styles.sectionHeading}>Photo Gallery</Text>
        <View style={styles.galleryGrid}>
          {photos.map((url, i) => (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image key={`${url}-${i}`} src={toProxiedUrl(url)} style={styles.galleryImage} />
          ))}
        </View>
      </View>
    </>
  )
}

function FooterSection({ data }: { data: EPKData }) {
  const year = new Date().getFullYear()
  return (
    <View style={styles.footer} fixed>
      {data.labelLogoUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
        <Image src={toProxiedUrl(data.labelLogoUrl)} style={styles.footerLogo} />
      ) : (
        <Text style={styles.footerText}>{data.labelName ?? 'Electronic Press Kit'}</Text>
      )}
      <Text style={styles.footerText}>{year}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Root PDF Document
// ---------------------------------------------------------------------------

interface EPKPdfDocumentProps {
  data: EPKData
}

export function EPKPdfDocument({ data }: EPKPdfDocumentProps) {
  const orientation = data.epkOrientation === 'landscape' ? 'landscape' : 'portrait'

  return (
    <Document
      title={`${data.artistName} — Electronic Press Kit`}
      author={data.labelName ?? data.artistName}
      subject="Electronic Press Kit"
      creator="darkTunes Music Group"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" orientation={orientation} style={styles.page}>
        <HeroSection data={data} />
        <QuoteSection data={data} />
        <BioSection data={data} />
        <InfoSection data={data} />
        <ContactsSection data={data} />
        <RidersSection data={data} />
        <LinksSection data={data} />
        <GallerySection data={data} />
        <FooterSection data={data} />
      </Page>
    </Document>
  )
}

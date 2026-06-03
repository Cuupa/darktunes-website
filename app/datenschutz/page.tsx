/**
 * app/datenschutz/page.tsx — Privacy Policy (Datenschutzerklärung) [RSC]
 *
 * Renders the full privacy policy. The main body text is stored as Markdown
 * in the CMS (site_settings key: datenschutz_content) so the legal team can
 * update it without a deployment. Falls back to a compliant boilerplate if
 * no content is configured yet.
 */

import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { getSiteSettings } from '@/lib/api/siteSettings'
import type { SiteSettings } from '@/types'
import type { Database } from '@/types/database'
import { DatenschutzContent } from './_components/DatenschutzContent'
import { getDictionary, getLocale } from '@/i18n/getDictionary'

// Cookie-free public client — safe inside unstable_cache callbacks where
// Next.js Dynamic APIs (cookies, headers) are unavailable. site_settings has
// a public-read RLS policy (FOR SELECT USING (TRUE)), so the anon key works.
function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    return getSiteSettings(createPublicSupabaseClient())
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — darkTunes Music Group',
  robots: { index: false },
}

export default async function DatenschutzPage() {
  const [settings, locale] = await Promise.all([
    getCachedSettings().catch(
      (): SiteSettings => ({
        labelName: 'darkTunes Music Group',
        labelTagline: '',
        contactEmail: 'info@darktunes.com',
        privacyPolicyUrl: '/datenschutz',
        termsUrl: '/impressum',
        instagramUrl: '',
        youtubeUrl: '',
        spotifyUrl: '',
        spotifyPlaylistUri: '',
        spotifyPlaylists: [],
        heroBadge: '',
        heroDescription: '',
        seoTitle: '',
        seoDescription: '',
        ogTitle: '',
        ogDescription: '',
        impressumCompanyName: 'darkTunes Music Group',
        impressumLegalForm: '',
        impressumRepresentative: '',
        impressumAddress: '',
        impressumVatId: '',
        impressumRegisterCourt: '',
        impressumRegisterNumber: '',
        impressumPhone: '',
        impressumEmail: 'info@darktunes.com',
        datenschutzContent: '',
        consentPlaceholderUrl: '',
        noiseOpacity: 0.04,
        crtScanlinesEnabled: true,
        vignetteIntensity: 0.5,
        shopifyStoreUrl: '',
        youtubeChannelId: '',
        carouselAutoplayMs: 0,
        videosPerPage: 9,
        videosLinkToPage: false,
        featureToggles: { promoPool: true, editorTools: true },
      }),
    ),
    getLocale(),
  ])
  const dict = await getDictionary(locale)

  const defaultContent = `
## 1. Datenschutz auf einen Blick

### Allgemeine Hinweise
Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.

### Datenerfassung auf dieser Website
**Wer ist verantwortlich für die Datenerfassung auf dieser Website?**
Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.

## 2. Hosting

Diese Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v. a. um IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe und sonstige Daten, die über eine Website generiert werden, handeln.

## 3. Allgemeine Hinweise und Pflichtinformationen

### Datenschutz
Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.

### Hinweis zur verantwortlichen Stelle
Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:

**${settings.impressumCompanyName}**  
${settings.impressumAddress}  
E-Mail: ${settings.impressumEmail}

Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten entscheidet.

### Speicherdauer
Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt.

### Ihre Rechte
Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen.

## 4. Externe Medien und Einbettungen

Diese Website kann externe Inhalte von Drittanbietern einbetten (z.B. Spotify, YouTube). Diese Inhalte werden erst nach Ihrer ausdrücklichen Zustimmung geladen. Vor der Zustimmung werden nur Platzhalter angezeigt. Durch Ihre Zustimmung stimmen Sie der Übermittlung von Daten an die jeweiligen Drittanbieter zu.

**Spotify**: Bei der Nutzung des Spotify-Einbettungsplayers gelten die Datenschutzbestimmungen der Spotify AB, Regeringsgatan 19, 111 53 Stockholm, Schweden. Weitere Informationen unter: https://www.spotify.com/de/legal/privacy-policy/

**YouTube**: Bei der Nutzung von YouTube-Videos gelten die Datenschutzbestimmungen der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Weitere Informationen unter: https://policies.google.com/privacy

## 5. Newsletter

Wenn Sie den auf der Website angebotenen Newsletter beziehen möchten, benötigen wir von Ihnen eine E-Mail-Adresse sowie Informationen, welche uns die Überprüfung gestatten, dass Sie der Inhaber der angegebenen E-Mail-Adresse sind und mit dem Empfang des Newsletters einverstanden sind. Weitere Daten werden nicht bzw. nur auf freiwilliger Basis erhoben. Diese Daten verwenden wir ausschließlich für den Versand der angeforderten Informationen und geben diese nicht an Dritte weiter.

Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie uns eine E-Mail an ${settings.impressumEmail} senden.

## 6. Plugins und Tools

### Schriftarten (Google Fonts)
Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten so genannte Web Fonts, die von Google bereitgestellt werden. Die Google Fonts sind lokal eingebunden, sodass keine Verbindung zu Servern von Google stattfindet.
`.trim()

  const content = settings.datenschutzContent || defaultContent

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-24 max-w-3xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block"
        >
          {dict.pages.backToHome}
        </Link>

        <h1 className="text-4xl lg:text-5xl font-bold mb-10 tracking-tight uppercase">
          Datenschutzerklärung
        </h1>

        <DatenschutzContent content={content} />

        <p className="text-xs text-muted-foreground border-t border-border pt-6 mt-12">
          Stand: {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}
        </p>
      </div>
    </div>
  )
}

/**
 * app/impressum/page.tsx — Legal Notice (Impressum) [RSC]
 *
 * Renders the mandatory German legal notice with CMS-backed content from
 * site_settings. All mandatory fields per § 5 TMG and § 55 RStV are mapped.
 */

import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSiteSettings } from '@/lib/api/siteSettings'
import type { SiteSettings } from '@/types'
import { getDictionary, getLocale } from '@/i18n/getDictionary'

const getCachedSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const client = await createServerSupabaseClient()
    return getSiteSettings(client)
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

export const metadata: Metadata = {
  title: 'Impressum — darkTunes Music Group',
  robots: { index: false },
}

export default async function ImpressumPage() {
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
      }),
    ),
    getLocale(),
  ])
  const dict = await getDictionary(locale)

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
          Impressum
        </h1>

        <div className="space-y-8 text-sm text-foreground/90 leading-relaxed">
          {/* § 5 TMG — Angaben gemäß § 5 TMG */}
          <section>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
              Angaben gemäß § 5 TMG
            </h2>
            <p className="font-semibold">{settings.impressumCompanyName}</p>
            {settings.impressumLegalForm && (
              <p className="text-muted-foreground">{settings.impressumLegalForm}</p>
            )}
            {settings.impressumAddress && (
              <p className="whitespace-pre-line mt-1">{settings.impressumAddress}</p>
            )}
          </section>

          {/* Vertreten durch */}
          {settings.impressumRepresentative && (
            <section>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
                Vertreten durch
              </h2>
              <p>{settings.impressumRepresentative}</p>
            </section>
          )}

          {/* Kontakt */}
          <section>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
              Kontakt
            </h2>
            {settings.impressumPhone && (
              <p>
                Telefon:{' '}
                <a
                  href={`tel:${settings.impressumPhone}`}
                  className="hover:text-accent transition-colors"
                >
                  {settings.impressumPhone}
                </a>
              </p>
            )}
            <p>
              E-Mail:{' '}
              <a
                href={`mailto:${settings.impressumEmail}`}
                className="hover:text-accent transition-colors"
              >
                {settings.impressumEmail}
              </a>
            </p>
          </section>

          {/* Umsatzsteuer-ID */}
          {settings.impressumVatId && (
            <section>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
                Umsatzsteuer-Identifikationsnummer
              </h2>
              <p>
                Gemäß § 27a Umsatzsteuergesetz: <span className="font-mono">{settings.impressumVatId}</span>
              </p>
            </section>
          )}

          {/* Handelsregister */}
          {(settings.impressumRegisterCourt || settings.impressumRegisterNumber) && (
            <section>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
                Handelsregister
              </h2>
              {settings.impressumRegisterCourt && (
                <p>Registergericht: {settings.impressumRegisterCourt}</p>
              )}
              {settings.impressumRegisterNumber && (
                <p>
                  Registernummer: <span className="font-mono">{settings.impressumRegisterNumber}</span>
                </p>
              )}
            </section>
          )}

          {/* Haftungsausschluss */}
          <section>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
              Haftungsausschluss (Disclaimer)
            </h2>
            <h3 className="font-semibold mb-1">Haftung für Inhalte</h3>
            <p className="text-muted-foreground mb-4">
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
              Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
              nach den allgemeinen Gesetzen verantwortlich.
            </p>
            <h3 className="font-semibold mb-1">Haftung für Links</h3>
            <p className="text-muted-foreground">
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
              Betreiber der Seiten verantwortlich.
            </p>
          </section>

          {/* Urheberrecht */}
          <section>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-3 text-foreground">
              Urheberrecht
            </h2>
            <p className="text-muted-foreground">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
              und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
              schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>

          <p className="text-xs text-muted-foreground border-t border-border pt-6">
            © {new Date().getFullYear()} {settings.impressumCompanyName}. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </div>
  )
}

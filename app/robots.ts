/**
 * app/robots.ts — Dynamic robots.txt (Next.js 15 Metadata API)
 *
 * Served at /robots.txt on every request.
 * Allows all public pages; blocks admin, portal, press, promo-pool, and API routes.
 * Always references the canonical sitemap.
 *
 * ── docs/agent/backend.md (robots.txt section) ─────────────────────────────
 * When adding a NEW protected route prefix (e.g. /new-private-area):
 *   1. Add a new `{ userAgent: '*', disallow: '/new-private-area/' }` entry
 *      inside the `rules` array below.
 * When adding a new sitemap endpoint:
 *   1. Add the full URL to the `sitemap` array below.
 * Do NOT add allow rules for pages that are protected by middleware.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/portal/',
          '/press/dashboard/',
          '/promo-pool/',
          '/api/',
          '/_next/',
        ],
      },
      // Block AI training crawlers that ignore noindex/noai meta tags
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'CCBot',
          'anthropic-ai',
          'Claude-Web',
          'PerplexityBot',
          'Omgilibot',
          'FacebookBot',
          'Bytespider',
        ],
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}

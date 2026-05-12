import type { MetadataRoute } from 'next'

/**
 * Dynamic PWA Web App Manifest
 *
 * Served at /manifest.webmanifest (Next.js 15 App Router convention).
 * Enables "Add to Home Screen" on Android and iOS so the site behaves like a
 * native standalone app — no browser chrome, correct splash colours, and
 * properly shaped adaptive icons.
 *
 * Icon paths reference placeholder files in /public/icons/.
 * Replace them with real darkTunes brand assets before going to production.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'darkTunes Music Group',
    short_name: 'darkTunes',
    description:
      'Official website for darkTunes Music Group — discover artists, releases, news, and videos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Matches --background (#101010) — prevents white flash during app boot
    background_color: '#101010',
    // Matches --primary / --accent (#493687) — used for the Android status bar
    theme_color: '#101010',
    lang: 'de',
    categories: ['music', 'entertainment'],
    icons: [
      // Standard icons (PNG, referenced by the OS for notifications / splash)
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      // Maskable icons — the OS can safely crop these into any shape (circle,
      // squircle, etc.) without adding an ugly white background box.
      // The artwork must have ~10 % safe-zone padding around the main icon.
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/icons/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        label: 'darkTunes Music Group – desktop',
      },
      {
        src: '/icons/screenshot-mobile.png',
        sizes: '390x844',
        type: 'image/png',
        label: 'darkTunes Music Group – mobile',
      },
    ],
  }
}

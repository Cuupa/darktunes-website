import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from 'serwist'

// Typescript shim for the build-injected precache manifest
declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Return the custom offline page when the network is unavailable
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
  runtimeCaching: [
    // --- Static assets from the Next.js build ---
    {
      matcher: /\/_next\/static\/.*/,
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }), // 1 year
        ],
      }),
    },
    // --- wsrv.nl image proxy (cover art, artist photos) ---
    {
      matcher: /^https:\/\/wsrv\.nl\//,
      handler: new CacheFirst({
        cacheName: 'wsrv-images',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    // --- Cloudflare R2 public assets ---
    {
      matcher: /^https:\/\/.*\.r2\.dev\//,
      handler: new StaleWhileRevalidate({
        cacheName: 'r2-assets',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          }),
        ],
      }),
    },
    // --- Google Fonts ---
    {
      matcher: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
      handler: new CacheFirst({
        cacheName: 'google-fonts',
        plugins: [
          new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }),
        ],
      }),
    },
    // --- HTML navigation (pages) — network-first, fall back to offline ---
    {
      matcher: ({ request }: { request: Request }) => request.destination === 'document',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24, // 24 h
          }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()

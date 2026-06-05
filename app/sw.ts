import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
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
    // --- Next.js image optimisation — always go to network.
    //     Caching opaque cross-origin responses here causes ERR_FAILED on
    //     hard refresh (F5) because Chrome rejects opaque (status 0) responses
    //     returned by the service worker for image requests.
    {
      matcher: /\/_next\/image/,
      handler: new NetworkOnly(),
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

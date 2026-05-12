import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Never intercept admin / API / auth routes in the service worker
  exclude: [/\/api\//, /\/admin\//, /\/portal\//, /\/press\//, /\/promo-pool\//],
})

const nextConfig: NextConfig = {
  // Allow images from Cloudflare R2 CDN and other external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'is*.mzstatic.com',
        pathname: '/image/**',
      },
    ],
  },
  // Tailwind v4 + tw-animate-css use PostCSS features that require transpiling
  transpilePackages: [],
}

export default withSerwist(nextConfig)

import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'
import withBundleAnalyzerInit from '@next/bundle-analyzer'
import { buildContentSecurityPolicy } from './src/lib/security/contentSecurityPolicy'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Never intercept admin / API / auth routes in the service worker
  exclude: [/\/api\//, /\/admin\//, /\/portal\//, /\/press\//, /\/promo-pool\//],
})

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === 'true',
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
      {
        protocol: 'https',
        hostname: 'wsrv.nl',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.bcbits.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ]
  },
  // Tailwind v4 + tw-animate-css use PostCSS features that require transpiling
  transpilePackages: [],
  serverExternalPackages: ['sharp', 'fontkit'],
  experimental: {
    optimizePackageImports: ['framer-motion', '@phosphor-icons/react', 'lenis', 'konva', 'react-konva'],
  },
}

export default withBundleAnalyzer(withSerwist(nextConfig))

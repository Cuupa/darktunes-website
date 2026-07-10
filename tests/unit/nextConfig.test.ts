import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

describe('next.config images', () => {
  it('disables Vercel Image Optimization (wsrv.nl handles resize/WebP)', () => {
    expect(nextConfig.images?.unoptimized).toBe(true)
  })

  it('allows wsrv.nl in remotePatterns', () => {
    const patterns = nextConfig.images?.remotePatterns ?? []
    expect(patterns.some((p) => p.hostname === 'wsrv.nl')).toBe(true)
  })
})
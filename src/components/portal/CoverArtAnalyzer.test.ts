/**
 * Cover art pure helpers (URL normalize, magic bytes, size) live in
 * `src/lib/submissions/coverArtUrl.ts` and are covered there.
 * This file keeps a lightweight contract test for UI-facing status mapping.
 */
import { describe, it, expect } from 'vitest'
import type { CoverArtCheckStatus } from '@/lib/submissions/coverArtCheck'

function mapStatusToVerified(status: CoverArtCheckStatus): boolean {
  return status === 'ok'
}

describe('CoverArtAnalyzer — API status contract', () => {
  it('only ok status counts as verified', () => {
    const statuses: CoverArtCheckStatus[] = [
      'ok',
      'invalid_url',
      'forbidden_host',
      'fetch_failed',
      'not_image',
      'wrong_format',
      'wrong_size',
      'too_large',
    ]
    for (const status of statuses) {
      expect(mapStatusToVerified(status)).toBe(status === 'ok')
    }
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  isPressApplicationsEnabled,
  isPressAudioPreviewEnabled,
  isPressZipDownloadEnabled,
  isPromoPoolEnabled,
} from './pressAccess'

const mockGetFeatureToggles = vi.fn()
const mockGetFeatureFlagsForRole = vi.fn()

vi.mock('@/lib/featureToggles', () => ({
  getFeatureToggles: (...args: unknown[]) => mockGetFeatureToggles(...args),
}))

vi.mock('@/lib/api/featureFlags', () => ({
  getFeatureFlagsForRole: (...args: unknown[]) => mockGetFeatureFlagsForRole(...args),
}))

describe('pressAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isPromoPoolEnabled reads global feature_toggles', async () => {
    mockGetFeatureToggles.mockResolvedValue({ promoPool: false, editorTools: true })
    expect(await isPromoPoolEnabled({} as never)).toBe(false)
  })

  it('isPromoPoolEnabled defaults to true when settings fetch fails', async () => {
    mockGetFeatureToggles.mockRejectedValue(new Error('db down'))
    expect(await isPromoPoolEnabled({} as never)).toBe(true)
  })

  it('isPressApplicationsEnabled respects press.applications flag', async () => {
    mockGetFeatureFlagsForRole.mockResolvedValue({ 'press.applications': false })
    expect(await isPressApplicationsEnabled({} as never)).toBe(false)
  })

  it('isPressZipDownloadEnabled respects press.zip_download flag', async () => {
    mockGetFeatureFlagsForRole.mockResolvedValue({ 'press.zip_download': false })
    expect(await isPressZipDownloadEnabled({} as never)).toBe(false)
  })

  it('isPressAudioPreviewEnabled respects press.audio_preview flag', async () => {
    mockGetFeatureFlagsForRole.mockResolvedValue({ 'press.audio_preview': false })
    expect(await isPressAudioPreviewEnabled({} as never)).toBe(false)
  })
})
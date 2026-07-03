import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSiteSettings } from './useSiteSettings'

const { getSiteSettings, upsertSiteSettings } = vi.hoisted(() => ({
  getSiteSettings: vi.fn(),
  upsertSiteSettings: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/supabase/client', () => ({ createBrowserSupabaseClient: () => ({}) }))
vi.mock('@/lib/api/siteSettings', () => ({
  getSiteSettings,
  upsertSiteSettings,
  SITE_SETTINGS_DEFAULTS: { labelName: 'darkTunes', labelTagline: '', contactEmail: '', privacyPolicyUrl: '', termsUrl: '', instagramUrl: '', youtubeUrl: '', spotifyUrl: '', youtubeChannelId: '', seoTitle: '', seoDescription: '', ogTitle: '', ogDescription: '', impressumCompanyName: '', impressumLegalForm: '', impressumRepresentative: '', impressumAddress: '', impressumVatId: '', impressumRegisterCourt: '', impressumRegisterNumber: '', impressumPhone: '', impressumEmail: '', datenschutzContent: '', consentPlaceholderUrl: '', noiseOpacity: 0, crtScanlinesEnabled: false, vignetteIntensity: 0, shopifyStoreUrl: '' },
}))

describe('useSiteSettings', () => {
  it('loads settings and saves updates', async () => {
    getSiteSettings.mockResolvedValue({ labelName: 'darkTunes', labelTagline: 'Tagline' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    const { result } = renderHook(() => useSiteSettings())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.settings.labelName).toBe('darkTunes')

    await act(async () => {
      await result.current.saveSettings({ ...result.current.settings, labelTagline: 'Updated' } as never)
    })

    expect(upsertSiteSettings).toHaveBeenCalled()
  })
})

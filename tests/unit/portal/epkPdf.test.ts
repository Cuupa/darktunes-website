import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/epk/printEpkDocument', () => ({
  generateEpkPdfFromPreview: vi.fn(async () => undefined),
}))

describe('generateEpkPdf', () => {
  it('delegates to generateEpkPdfFromPreview with artist metadata and messages', async () => {
    const { generateEpkPdfFromPreview } = await import('@/lib/epk/printEpkDocument')
    const { buildEpkPdfMessages, generateEpkPdf } = await import('../../../app/portal/profile/_components/epkPdf')

    const root = document.createElement('article')
    const mockT = ((key: string) => {
      const labels: Record<string, string> = {
        profile_epk_error_popup_blocked: 'popup',
        profile_epk_error_preview_unavailable: 'preview',
        profile_epk_error_print_failed: 'print',
      }
      return labels[key] ?? key
    }) as unknown as Parameters<typeof buildEpkPdfMessages>[0]
    const messages = buildEpkPdfMessages(mockT)

    await generateEpkPdf(
      { artistName: 'Test Artist', epkOrientation: 'landscape' },
      messages,
      root,
    )

    expect(generateEpkPdfFromPreview).toHaveBeenCalledWith({
      artistName: 'Test Artist',
      orientation: 'landscape',
      sourceRoot: root,
      messages,
    })
  })
})
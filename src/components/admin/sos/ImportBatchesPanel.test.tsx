import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportBatchesPanel } from './ImportBatchesPanel'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({
  useMergedAccountingLabels: (fallback: Record<string, string>) => fallback,
}))

describe('ImportBatchesPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows a load error instead of the empty archive message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    render(<ImportBatchesPanel labelArtists={[]} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load import batches')
    expect(screen.queryByText(/No Bronze CSV archives yet/)).toBeNull()
  })
})

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PayoutManager } from './PayoutManager'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({
  useMergedAccountingLabels: (fallback: Record<string, string>) => fallback,
}))
vi.mock('@/lib/admin/getAccessToken', () => ({
  getAdminAccessToken: vi.fn().mockResolvedValue('token'),
}))

describe('PayoutManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows a ledger load error instead of the empty payout message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'register down' }),
    } as Response)

    render(
      <PayoutManager
        labelArtists={[]}
        labelInfo={{ name: 'darkTunes', address: '' }}
        periodStart="2026-01"
        periodEnd="2026-01"
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('register down')
    expect(screen.queryByText(/No ledger payouts for this period/)).toBeNull()
  })
})

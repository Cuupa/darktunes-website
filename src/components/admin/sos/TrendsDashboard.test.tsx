import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TrendsDashboard } from './TrendsDashboard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({
  useMergedAccountingLabels: (fallback: Record<string, string>) => fallback,
}))

describe('TrendsDashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows a load error instead of the empty trends message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'summaries down' }),
    } as Response)

    render(<TrendsDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('summaries down')
    expect(screen.queryByText(/No historical data yet/)).toBeNull()
  })
})

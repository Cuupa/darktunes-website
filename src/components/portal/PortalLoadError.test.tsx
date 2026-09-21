import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortalLoadError } from './PortalLoadError'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('PortalLoadError', () => {
  it('shows the error instead of looking empty', () => {
    render(<PortalLoadError message="Could not load statements" retryLabel="Reload" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load statements')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })
})

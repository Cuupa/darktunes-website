import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MonthField } from './month-field'

describe('MonthField', () => {
  it('opens the month grid, selects a month, and closes', () => {
    const onChange = vi.fn()
    render(
      <MonthField
        id="period"
        label="Period"
        value=""
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Period/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Mar' }))

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-03$/))
    expect(screen.queryByRole('listbox', { name: 'Month' })).not.toBeInTheDocument()
  })

  it('shows selected month label on the trigger', () => {
    render(
      <MonthField
        id="period"
        label="Period"
        value="2026-08"
        onChange={vi.fn()}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Period/i })
    expect(trigger).toHaveTextContent('Aug 2026')
  })
})

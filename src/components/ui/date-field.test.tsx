import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DateField } from './date-field'
import { Dialog, DialogContent, DialogTitle } from './dialog'

describe('DateField', () => {
  it('opens the calendar and selects a day (ISO storage)', () => {
    const onChange = vi.fn()
    render(
      <DateField
        id="releaseDate"
        label="Release Date"
        required
        value=""
        onChange={onChange}
      />,
    )

    // Label htmlFor associates the trigger; accessible name is the label text
    fireEvent.click(screen.getByRole('button', { name: /Release Date/i }))

    const grid = screen.getByRole('grid')
    const dayButtons = within(grid).getAllByRole('button')
    const enabled = dayButtons.find((btn) => !(btn as HTMLButtonElement).disabled)
    expect(enabled).toBeTruthy()
    fireEvent.click(enabled!)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('formats stored ISO value as dd.MM.yyyy on the trigger', () => {
    render(
      <DateField
        id="releaseDate"
        label="Release Date"
        value="2026-08-07"
        onChange={vi.fn()}
      />,
    )
    const trigger = screen.getByRole('button', { name: /Release Date/i })
    expect(trigger).toHaveTextContent('07.08.2026')
  })

  it('renders the calendar popover above dialog stacking (z-[10000] class)', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>New Release</DialogTitle>
          <DateField
            id="releaseDate"
            label="Release Date"
            value=""
            onChange={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Release Date/i }))

    const popover = document.querySelector('[data-slot="popover-content"]')
    expect(popover).toBeTruthy()
    expect(popover?.className).toMatch(/z-\[10000\]/)
  })
})

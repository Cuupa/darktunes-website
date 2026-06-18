'use client'

/**
 * GenreTagPicker
 *
 * A searchable multi-select tag picker for genres. Renders selected genres as
 * removable chips and provides a combobox-style input to search and add more
 * genres from the central catalogue.
 *
 * Props:
 *  - value:    string[]   — currently selected genre names
 *  - onChange: (names: string[]) => void
 *  - genres:   { id: string; name: string }[]  — available genre catalogue
 *  - disabled?: boolean
 *  - placeholder?: string
 */

import { useState, useRef, useCallback, useId } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface GenreTagPickerProps {
  value: string[]
  onChange: (names: string[]) => void
  genres: { id: string; name: string }[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function GenreTagPicker({
  value,
  onChange,
  genres,
  disabled = false,
  placeholder = 'Search genres…',
  className,
}: GenreTagPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const filtered = genres.filter(
    (g) =>
      !value.includes(g.name) &&
      g.name.toLowerCase().includes(query.toLowerCase()),
  )

  const select = useCallback(
    (name: string) => {
      if (!value.includes(name)) {
        onChange([...value, name])
      }
      setQuery('')
      setOpen(false)
      inputRef.current?.focus()
    },
    [value, onChange],
  )

  const remove = useCallback(
    (name: string) => {
      onChange(value.filter((n) => n !== name))
    },
    [value, onChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1])
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) {
        select(filtered[0].name)
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Tag chips + input */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={cn(
          'flex min-h-[44px] flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
        aria-disabled={disabled}
      >
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
          >
            {name}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(name) }}
                aria-label={'Remove ' + name}
                className="rounded-full p-0.5 hover:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X size={10} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          aria-label="Add genre"
          aria-autocomplete="list"
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
        >
          {filtered.map((g) => (
            <li
              key={g.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); select(g.name) }}
              className="cursor-pointer px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
            >
              {g.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

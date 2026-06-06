'use client'

/**
 * app/portal/help/_components/HelpPanel.tsx — Client Component
 *
 * Accordion-based FAQ help panel for the Artist Portal.
 * Fully static — no API calls.
 */

import { useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import type { Dictionary } from '@/i18n/types'

interface HelpSection {
  title: string
  body: string
}

function AccordionSection({ title, body }: HelpSection) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-medium"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        {open ? (
          <CaretUp size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretDown size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>
      )}
    </div>
  )
}

export function HelpPanel({ dict }: { dict: Dictionary['portal'] }) {
  const sections: HelpSection[] = [
    { title: dict.help_epk_title, body: dict.help_epk_body },
    { title: dict.help_releases_title, body: dict.help_releases_body },
    { title: dict.help_events_title, body: dict.help_events_body },
    { title: dict.help_invoices_title, body: dict.help_invoices_body },
    { title: dict.help_statements_title, body: dict.help_statements_body },
    { title: dict.help_settings_title, body: dict.help_settings_body },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{dict.help_heading}</h1>
        <p className="text-muted-foreground mt-1">{dict.help_intro}</p>
      </div>
      <div className="space-y-3">
        {sections.map((s) => (
          <AccordionSection key={s.title} title={s.title} body={s.body} />
        ))}
      </div>
    </div>
  )
}

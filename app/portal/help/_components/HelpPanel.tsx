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

interface FAQItem {
  q: string
  a: string
}

interface FAQSection {
  title: string
  items: FAQItem[]
}

function AccordionSection({ title, items }: FAQSection) {
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
        <dl className="divide-y divide-border border-t border-border">
          {items.map(({ q, a }) => (
            <div key={q} className="px-4 py-3 space-y-1">
              <dt className="font-medium text-sm">{q}</dt>
              <dd className="text-sm text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function HelpPanel({ dict }: { dict: Dictionary['portal'] }) {
  const sections: FAQSection[] = [
    {
      title: dict.help_section_profile,
      items: [
        { q: dict.help_q_bio, a: dict.help_a_bio },
        { q: dict.help_q_photo, a: dict.help_a_photo },
        { q: dict.help_q_epk_export, a: dict.help_a_epk_export },
      ],
    },
    {
      title: dict.help_section_releases,
      items: [
        { q: dict.help_q_submit_release, a: dict.help_a_submit_release },
        { q: dict.help_q_checklist, a: dict.help_a_checklist },
      ],
    },
    {
      title: dict.help_section_events,
      items: [
        { q: dict.help_q_add_event, a: dict.help_a_add_event },
        { q: dict.help_q_ics, a: dict.help_a_ics },
      ],
    },
    {
      title: dict.help_section_invoices,
      items: [
        { q: dict.help_q_create_invoice, a: dict.help_a_create_invoice },
        { q: dict.help_q_send_invoice, a: dict.help_a_send_invoice },
      ],
    },
    {
      title: dict.help_section_statements,
      items: [
        { q: dict.help_q_statements, a: dict.help_a_statements },
      ],
    },
    {
      title: dict.help_section_settings,
      items: [
        { q: dict.help_q_language, a: dict.help_a_language },
        { q: dict.help_q_password, a: dict.help_a_password },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{dict.help_heading}</h1>
        <p className="text-muted-foreground mt-1">{dict.help_subheading}</p>
      </div>
      <div className="space-y-3">
        {sections.map((s) => (
          <AccordionSection key={s.title} title={s.title} items={s.items} />
        ))}
      </div>
    </div>
  )
}

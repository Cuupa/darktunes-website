'use client'

/**
 * app/portal/marketing/_components/PromoTimeline.tsx
 *
 * Read-only chronological feed of marketing activities documented by the label.
 * Visible only to the linked artist (data isolation enforced by Supabase RLS).
 */

import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarBlank, CurrencyEur, MegaphoneSimple } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { PortalEmptyState } from '@/components/portal/PortalEmptyState'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { PromoLogEntry } from '@/types'
import type { Dictionary } from '@/i18n/types'

interface PromoTimelineProps {
  entries: PromoLogEntry[]
  dict: Dictionary['portal']
}

function formatBudget(amount: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd. MMMM yyyy', { locale: de })
  } catch {
    return dateStr
  }
}

export function PromoTimeline({ entries, dict }: PromoTimelineProps) {
  if (entries.length === 0) {
    return (
      <PortalEmptyState
        icon={MegaphoneSimple}
        heading={dict.promo_log_empty_heading}
        description={dict.promo_log_empty_description}
      />
    )
  }

  return (
    <ol className="relative space-y-0" aria-label={dict.promo_log_heading}>
      {entries.map((entry, idx) => (
        <li key={entry.id} className="relative pl-8 pb-8 last:pb-0">
          {/* Vertical timeline line */}
          {idx < entries.length - 1 && (
            <span
              className="absolute left-[11px] top-5 bottom-0 w-px bg-border"
              aria-hidden="true"
            />
          )}
          {/* Dot */}
          <span
            className="absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 border border-primary/40"
            aria-hidden="true"
          >
            <MegaphoneSimple size={12} weight="bold" className="text-primary" />
          </span>

          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              {/* Date + Budget header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time
                  dateTime={entry.actionDate}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground"
                >
                  <CalendarBlank size={13} aria-hidden="true" />
                  {formatDate(entry.actionDate)}
                </time>
                {entry.budgetAmount != null && entry.budgetAmount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <CurrencyEur size={12} aria-hidden="true" />
                    {formatBudget(entry.budgetAmount, entry.budgetCurrency)}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {entry.description}
              </p>

              {/* Proof image */}
              {entry.proofUrl && (
                <a
                  href={entry.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md overflow-hidden border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`${dict.promo_log_view_proof} — ${entry.description}`}
                >
                  <Image
                    src={getOptimizedImageUrl(entry.proofUrl, 800)}
                    alt={`${dict.promo_log_proof_alt} — ${entry.description}`}
                    width={640}
                    height={360}
                    className="w-full h-auto object-cover max-h-64"
                    unoptimized
                  />
                </a>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  )
}

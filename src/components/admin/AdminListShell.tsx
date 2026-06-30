'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AdminListShellProps {
  /** Fixed toolbar: search, filters, primary actions. */
  header: ReactNode
  /** Scrollable table body (typically AdminDataTable). */
  children: ReactNode
  /** Fixed footer: pagination, bulk actions summary. */
  footer?: ReactNode
  className?: string
  tableContainerClassName?: string
}

/**
 * Viewport-filling list layout for admin CRUD pages.
 *
 * Requires AdminPageShell `layout="list"` so the flex height chain reaches
 * ScrollableAppShell. Keeps toolbar + pagination fixed; table scrolls internally.
 */
export function AdminListShell({
  header,
  children,
  footer,
  className,
  tableContainerClassName,
}: AdminListShellProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 pb-4">{header}</div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card',
          tableContainerClassName,
        )}
      >
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          data-lenis-prevent
        >
          {children}
        </div>
      </div>

      {footer ? <div className="shrink-0 pt-4">{footer}</div> : null}
    </div>
  )
}
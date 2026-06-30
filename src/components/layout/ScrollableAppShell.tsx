import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ScrollableAppShellProps {
  sidebar?: ReactNode
  children: ReactNode
  /** Pinned below the scroll pane (e.g. admin footer). */
  footer?: ReactNode
  /** Disables main scroll (full-bleed tools like EPK builder). */
  lockScroll?: boolean
  mainClassName?: string
  contentClassName?: string
}

/**
 * Shared dashboard shell for admin, portal, and similar app layouts.
 *
 * Scroll contract (must stay in sync with LenisProvider):
 * - Outer: `h-dvh overflow-hidden` constrains height to the viewport.
 * - Inner: `flex-1 min-h-0 overflow-y-auto` is the sole vertical scroll pane.
 * - `data-lenis-prevent` yields wheel/touch events to native scroll inside the pane.
 *
 * Without the height constraint, `overflow-y-auto` never activates and Lenis blocks
 * document scroll — the page appears frozen.
 */
export function ScrollableAppShell({
  sidebar,
  children,
  footer,
  lockScroll = false,
  mainClassName,
  contentClassName,
}: ScrollableAppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background md:flex-row">
      {sidebar}
      <main className={cn('flex min-h-0 min-w-0 flex-1 flex-col', mainClassName)}>
        <div
          data-lenis-prevent
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            lockScroll ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain',
            contentClassName,
          )}
        >
          {children}
        </div>
        {footer}
      </main>
    </div>
  )
}
'use client'

/**
 * TacticalModal – "Tactical Gothic FUI" dialog primitive.
 *
 * Aesthetic rules enforced:
 *  1. "Blade Slice" entry/exit: the panel is revealed via a `clip-path` inset
 *     that collapses to a thin horizontal slit and then slams open – simulating
 *     a mechanical shutter or tactical visor. No soft fade-in for the panel.
 *  2. Zero-bounce spring: `stiffness: 400, damping: 40` – the panel snaps open
 *     like a weapon bolt, with no oscillation.
 *  3. Tactical HUD header: monospace font, all-caps, wide letter-spacing; a
 *     single 1 px top-accent stripe in primary colour denotes "active terminal".
 *  4. 1 px sharp borders throughout; no border radius.
 *
 * Accessibility:
 *  - `role="dialog"` + `aria-modal="true"` on the panel.
 *  - Title and description are bound via `aria-labelledby` / `aria-describedby`.
 *  - Escape key closes the modal.
 *  - Focus moves to the close button when the modal opens, and is restored to
 *    the previously focused element when it closes.
 *  - Full focus trap: Tab/Shift+Tab cycle is constrained inside the panel.
 *  - Body scroll is locked while the modal is open.
 *
 * Implements the `DialogProps` contract from `@/lib/component-contracts`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { DialogProps } from '@/lib/component-contracts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** "Blade Slice" spring – snaps open / slams shut, zero bounce. */
const BLADE_SPRING = { type: 'spring', stiffness: 400, damping: 40 } as const

/** Selectors that match every keyboard-reachable element. */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TacticalModalProps extends DialogProps {
  /** Displayed in the HUD header as the mission / operation title. */
  title?: string
  /**
   * Optional sub-line beneath the title (e.g. an ISRC code, a date, or
   * a short context string). Rendered in monospace at a reduced opacity.
   */
  description?: string
  /** Content rendered inside the modal body. */
  children: ReactNode
  /** Additional Tailwind classes applied to the scrollable body container. */
  className?: string
  /**
   * Tailwind max-width class for the panel.
   * @default 'max-w-2xl'
   */
  maxWidth?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable "Tactical Gothic FUI" modal dialog.
 *
 * Usage:
 * ```tsx
 * const [open, setOpen] = useState(false)
 *
 * <TacticalModal
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   title="OPERATION DUSK SIGNAL"
 *   description="SYS // 2026-05-11T17:00:00Z"
 * >
 *   <p>Modal body content.</p>
 * </TacticalModal>
 * ```
 */
export function TacticalModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'max-w-2xl',
}: TacticalModalProps) {
  // SSR guard – createPortal must only run in the browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const prefersReducedMotion = useReducedMotion()

  const titleId = useId()
  const descId = useId()

  /** The panel element – used as the focus-trap boundary. */
  const panelRef = useRef<HTMLDivElement>(null)
  /** The close button – receives focus when the modal opens. */
  const closeRef = useRef<HTMLButtonElement>(null)
  /** The element that was focused before the modal opened. */
  const returnFocusRef = useRef<Element | null>(null)

  // ── Focus management & scroll lock ──────────────────────────────────────
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement
      document.body.style.overflow = 'hidden'
      // Brief timeout lets the clip-path animation start before stealing focus,
      // so screen readers don't read the panel before it is visually revealed.
      const id = setTimeout(() => closeRef.current?.focus(), 60)
      return () => clearTimeout(id)
    } else {
      document.body.style.overflow = ''
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus()
      }
    }
  }, [open])

  // ── Keyboard handler: Escape + focus trap ────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────────── */}
          <motion.div
            key="tactical-backdrop"
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: 'linear' }}
            onClick={onClose}
          />

          {/* ── Centring shell ───────────────────────────────────────────── */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* ── Panel ────────────────────────────────────────────────── */}
            <motion.div
              key="tactical-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              className={cn(
                'relative w-full bg-card border border-border overflow-hidden',
                // No border-radius – sharp industrial edges.
                'rounded-none',
                maxWidth,
              )}
              // "Blade Slice": panel starts as a horizontal sliver and opens
              // vertically like a mechanical shutter.
              initial={prefersReducedMotion ? { opacity: 0 } : { clipPath: 'inset(50% 0 50% 0)' }}
              animate={prefersReducedMotion ? { opacity: 1 } : { clipPath: 'inset(0% 0 0% 0)' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { clipPath: 'inset(50% 0 50% 0)' }}
              transition={prefersReducedMotion ? { duration: 0 } : BLADE_SPRING}
              // Prevent backdrop-click from firing when clicking inside the panel.
              onClick={(e) => e.stopPropagation()}
            >
              {/* Active-terminal indicator: 2 px top stripe in primary colour */}
              <div
                aria-hidden="true"
                className="absolute top-0 inset-x-0 h-[2px] bg-primary"
              />

              {/* ── HUD header ─────────────────────────────────────────── */}
              <div className="flex items-start justify-between border-b border-border px-4 pt-5 pb-3 gap-4">
                <div className="min-w-0 flex-1">
                  {title && (
                    <p
                      id={titleId}
                      className="font-mono text-xs uppercase tracking-[0.2em] text-foreground leading-none truncate"
                    >
                      {title}
                    </p>
                  )}
                  {description && (
                    <p
                      id={descId}
                      className="font-mono text-[10px] text-muted-foreground mt-1 truncate"
                    >
                      {description}
                    </p>
                  )}
                </div>

                {/* Close – styled as a small tactical icon control */}
                <button
                  ref={closeRef}
                  onClick={onClose}
                  aria-label="Close dialog"
                  className={cn(
                    'tactical-chromatic',
                    'shrink-0 p-1.5 mt-0.5',
                    'text-muted-foreground hover:text-foreground',
                    'border border-transparent hover:border-border',
                    'transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>

              {/* ── Body ───────────────────────────────────────────────── */}
              <div data-lenis-prevent className={cn('overflow-y-auto max-h-[70vh] p-6', className)}>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

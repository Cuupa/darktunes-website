'use client'

/**
 * TacticalButton – "Tactical Gothic FUI" primary interactive primitive.
 *
 * Aesthetic rules enforced:
 *  - Zero-bounce snap: whileTap uses a high-stiffness / high-damping spring so
 *    the press feedback feels like a weapon-bolt lock, not a bouncy UI widget.
 *  - Chromatic aberration hover: the `.tactical-chromatic` CSS class offsets the
 *    red and blue text channels by ±1 px on hover, simulating a glitched CRT or
 *    damaged tactical camera feed. No glow, no drop-shadow, no scale-up.
 *  - Sharp edges: border-radius is intentionally zero (`rounded-none`).
 *  - Monospace typography: `font-mono` + `uppercase` + wide letter-spacing give
 *    every label a raw data-terminal feel.
 */

import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

/** High-stiffness spring – elements snap/lock, never wobble. */
const SNAP_SPRING = { type: 'spring', stiffness: 600, damping: 45 } as const

export type TacticalButtonVariant = 'primary' | 'secondary' | 'ghost'
export type TacticalButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export interface TacticalButtonProps extends HTMLMotionProps<'button'> {
  /** Visual variant. Defaults to `'secondary'`. */
  variant?: TacticalButtonVariant
  /** Size preset. Defaults to `'default'`. */
  size?: TacticalButtonSize
}

const variantClasses: Record<TacticalButtonVariant, string> = {
  /** Filled with brand-violet; still has a visible border for the "hardware" look. */
  primary:
    'bg-primary text-primary-foreground border border-primary hover:bg-primary/85 hover:border-primary/70',
  /** Transparent with a 1 px border – the default tactical outline button. */
  secondary:
    'bg-transparent text-foreground border border-border hover:border-foreground/50',
  /** Borderless; only shows a border on hover. Used for icon controls. */
  ghost:
    'bg-transparent text-muted-foreground border border-transparent hover:border-border hover:text-foreground',
}

const sizeClasses: Record<TacticalButtonSize, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-7 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9 p-0',
}

/**
 * Reusable tactical button with zero-bounce press feedback and chromatic
 * aberration hover state. Accepts all native `<button>` props.
 */
export const TacticalButton = forwardRef<HTMLButtonElement, TacticalButtonProps>(
  function TacticalButton(
    { className, variant = 'secondary', size = 'default', ...props },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        // Press: compress 3 % with a snap spring – like a physical button click.
        whileTap={{ scale: 0.97 }}
        transition={SNAP_SPRING}
        className={cn(
          // Layout
          'inline-flex items-center justify-center gap-2 whitespace-nowrap',
          // Typography – tactical terminal aesthetic
          'font-mono text-sm uppercase tracking-wider',
          // Sharp corners, no softening
          'rounded-none',
          // Transitions (colors only; scale is handled by Framer Motion)
          'transition-colors',
          // Disabled state
          'disabled:pointer-events-none disabled:opacity-40',
          // Focus ring – 1 px ring offset for keyboard users
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          // Chromatic aberration on hover (defined in src/index.css)
          'tactical-chromatic',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)

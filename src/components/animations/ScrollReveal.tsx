'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  /** Delay before the element animates in (seconds). Default: 0. */
  delay?: number
  /** CSS class names to apply to the wrapper element. */
  className?: string
}

/**
 * ScrollReveal – fades and slides a section into view as it enters the
 * viewport.  Respects `prefers-reduced-motion` by rendering children
 * immediately without animation.
 */
export function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(ref, { once: true, margin: '0px 0px -80px 0px' })

  return (
    <motion.div
      ref={ref}
      className={className}
      animate={
        prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : isInView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 24 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.5, ease: 'easeOut', delay }
      }
    >
      {children}
    </motion.div>
  )
}

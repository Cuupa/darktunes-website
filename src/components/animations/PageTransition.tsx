'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

const variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

/**
 * PageTransition – wraps page content to animate on route entry/exit.
 *
 * Uses a spring-based fade+slide so new pages feel intentional rather than
 * abrupt. Respects `prefers-reduced-motion` by skipping all animation.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      variants={prefersReducedMotion ? {} : variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 400, damping: 40, duration: 0.4 }
      }
    >
      {children}
    </motion.div>
  )
}

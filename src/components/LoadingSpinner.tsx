'use client'

import { motion, useReducedMotion } from 'framer-motion'

interface LoadingSpinnerProps {
  /** Diameter of the spinner in pixels. Default: 40. */
  size?: number
}

/**
 * LoadingSpinner – a Framer Motion arc spinner that replaces CSS
 * `animate-spin` for a smoother, brand-consistent loading indicator.
 *
 * The rotating arc uses a stroke-dashoffset animation so the sweep
 * eases in/out rather than jumping.
 *
 * When the user prefers reduced motion the rotation is suppressed and only
 * a static arc is shown, satisfying WCAG 2.3.3 (Animation from Interactions).
 */
export function LoadingSpinner({ size = 40 }: LoadingSpinnerProps) {
  const prefersReducedMotion = useReducedMotion()
  const r = (size - 4) / 2
  const circumference = 2 * Math.PI * r

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      animate={prefersReducedMotion ? {} : { rotate: 360 }}
      transition={prefersReducedMotion ? {} : { duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        opacity={0.2}
      />
      {/* Spinner arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.7}
        strokeLinecap="round"
        className="text-accent"
      />
    </motion.svg>
  )
}

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getAnimationPreset, DEFAULT_ANIMATION_PRESET_KEY } from '@/config/animationPresets'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * Read the active animation preset key from the `data-animation-preset`
 * attribute that the root layout sets on `<html>`.  Falls back to the default
 * on the server and on first render.
 */
function useAnimationPresetKey(): string {
  const [key, setKey] = useState<string>(DEFAULT_ANIMATION_PRESET_KEY)

  useEffect(() => {
    const attr = document.documentElement.dataset.animationPreset
    if (attr) setKey(attr)
  }, [])

  return key
}

/**
 * PageTransition – wraps page content to animate on route entry/exit.
 *
 * The active animation preset is read from the `data-animation-preset`
 * attribute on `<html>` (set server-side by RootLayout from the admin
 * ThemeConfig).  Respects `prefers-reduced-motion` by skipping animation.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion()
  const presetKey = useAnimationPresetKey()
  const { variants, transition } = getAnimationPreset(presetKey)

  return (
    <motion.div
      variants={prefersReducedMotion ? {} : variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={prefersReducedMotion ? { duration: 0 } : transition}
    >
      {children}
    </motion.div>
  )
}


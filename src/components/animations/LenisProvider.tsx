'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Lenis from 'lenis'

interface LenisProviderProps {
  children: ReactNode
}

/**
 * Global smooth-scrolling provider using Lenis.
 *
 * Wraps the entire application so every scroll consumer benefits from the
 * kinematic interpolation without any per-component setup. The Lenis
 * instance is synchronised with requestAnimationFrame so it integrates
 * cleanly with Framer Motion layout animations.
 *
 * When a Radix UI modal/dialog is open, the library adds `data-scroll-locked`
 * to `<body>`. We observe this attribute and pause Lenis so the modal's own
 * scrollable area can receive wheel events normally.
 *
 * Usage: wrap your root layout once — do NOT nest multiple LenisProviders.
 */
export function LenisProvider({ children }: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
      infinite: false,
    })

    lenisRef.current = lenis

    let rafId: number

    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }

    rafId = requestAnimationFrame(raf)

    // Pause Lenis while any Radix UI dialog/sheet/popover is open.
    // Radix sets data-scroll-locked="1" on <body> via react-remove-scroll
    // when it locks page scrolling. Without this, Lenis intercepts wheel
    // events and the modal's own scroll area cannot be scrolled.
    const observer = new MutationObserver(() => {
      if (document.body.dataset.scrollLocked === '1') {
        lenis.stop()
      } else {
        lenis.start()
      }
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-scroll-locked'],
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <>{children}</>
}

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

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <>{children}</>
}

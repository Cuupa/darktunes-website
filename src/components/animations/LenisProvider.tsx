'use client'

import { useEffect, type ReactNode } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'

// Re-export useLenis so any component can import the hook from a single location
export { useLenis }

interface LenisProviderProps {
  children: ReactNode
}

/**
 * Pauses Lenis whenever a Radix UI dialog/sheet/popover locks body scroll.
 * Radix sets `data-scroll-locked="1"` on `<body>` via react-remove-scroll.
 * Without this observer Lenis intercepts wheel events and the modal's own
 * scrollable area cannot be scrolled.
 */
function ScrollLockObserver() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
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
    return () => observer.disconnect()
  }, [lenis])

  return null
}

/**
 * Global smooth-scrolling provider using Lenis.
 *
 * Wraps the entire application so every scroll consumer benefits from the
 * kinematic interpolation without any per-component setup. Uses ReactLenis
 * with `root` mode so the `useLenis()` hook is available anywhere in the tree.
 *
 * Usage: wrap your root layout once — do NOT nest multiple LenisProviders.
 */
export function LenisProvider({ children }: LenisProviderProps) {
  return (
    <ReactLenis
      root
      options={{
        duration: 0.9,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.5,
        infinite: false,
      }}
    >
      <ScrollLockObserver />
      {children}
    </ReactLenis>
  )
}

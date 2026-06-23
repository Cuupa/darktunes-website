'use client'

import { useEffect, type ReactNode } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'

export { useLenis }

interface LenisProviderProps {
  children: ReactNode
}

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

export function LenisProvider({ children }: LenisProviderProps) {
  return (
    <ReactLenis
      root
      options={{
        // Optimierte Einstellungen für Mac Trackpad (besseres Momentum + weniger "Hängen")
        lerp: 0.08,
        duration: 0.55,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

        // Wichtig für Mac Trackpads
        syncTouch: true,
        syncTouchLerp: 0.075,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.3,

        infinite: false,
        prevent: (node: Element) =>
          node.closest('[data-lenis-prevent]') !== null,
      }}
    >
      <ScrollLockObserver />
      {children}
    </ReactLenis>
  )
}

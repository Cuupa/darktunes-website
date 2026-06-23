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
        // Bessere Performance + smooth
        lerp: 0.12,                    // ← WICHTIG: statt nur duration
        duration: 0.9,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        
        // Touch optimiert
        touchMultiplier: 1.8,
        wheelMultiplier: 0.9,
        
        infinite: false,
        
        // Deutlich performanter prevent
        prevent: (node: Element) => {
          // Schnellere Prüfung
          return node.hasAttribute('data-lenis-prevent') || 
                 !!node.closest('[data-lenis-prevent]')
        },
      }}
    >
      <ScrollLockObserver />
      {children}
    </ReactLenis>
  )
}

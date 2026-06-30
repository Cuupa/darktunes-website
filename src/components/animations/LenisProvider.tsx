'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { isDashboardRoute } from '@/lib/scroll/dashboardRoutes'
import { shouldPreventLenis } from '@/lib/scroll/lenisPrevent'

export { useLenis }

interface LenisProviderProps {
  children: ReactNode
}

/** Stop Lenis on admin/portal so ScrollableAppShell uses native wheel scroll. */
function DashboardLenisGuard() {
  const lenis = useLenis()
  const pathname = usePathname()
  const onDashboard = isDashboardRoute(pathname)

  useEffect(() => {
    if (!lenis) return
    if (onDashboard) {
      lenis.stop()
    } else if (document.body.dataset.scrollLocked !== '1') {
      lenis.start()
    }
  }, [lenis, onDashboard])

  return null
}

function ScrollLockObserver() {
  const lenis = useLenis()
  const pathname = usePathname()

  useEffect(() => {
    if (!lenis) return
    const observer = new MutationObserver(() => {
      if (document.body.dataset.scrollLocked === '1') {
        lenis.stop()
      } else if (!isDashboardRoute(pathname)) {
        lenis.start()
      }
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-scroll-locked'],
    })
    return () => observer.disconnect()
  }, [lenis, pathname])

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
        prevent: shouldPreventLenis,
      }}
    >
      <DashboardLenisGuard />
      <ScrollLockObserver />
      {children}
    </ReactLenis>
  )
}
